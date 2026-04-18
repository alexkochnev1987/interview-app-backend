# ECS Cluster (shared between environments — the cluster itself is free)
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = var.environment == "prod" ? "enabled" : "disabled"
  }
}

# CloudWatch log group for ECS tasks
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.project_name}-${var.environment}"
  retention_in_days = var.environment == "prod" ? 30 : 7
}

# ECS Task Execution Role (allows ECS to pull images from ECR, write logs)
resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-${var.environment}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS Task Role (permissions for the running application)
resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-${var.environment}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task" {
  name = "${var.project_name}-${var.environment}-ecs-task-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_bucket_name}",
          "arn:aws:s3:::${var.s3_bucket_name}/${var.environment}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "states:StartExecution"
        ]
        Resource = "*"
      }
    ]
  })
}

# Task definition
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-${var.environment}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "backend"
    image = "${var.ecr_repo_url}:${var.environment}-latest"
    portMappings = [{
      containerPort = var.app_port
      protocol      = "tcp"
    }]
    environment = [
      { name = "NODE_ENV", value = var.environment == "prod" ? "production" : "development" },
      { name = "PORT", value = tostring(var.app_port) },
      { name = "S3_PREFIX", value = "${var.environment}/" },
      { name = "AWS_S3_BUCKET", value = var.s3_bucket_name },
      { name = "JWT_SECRET", value = var.jwt_secret },
      { name = "GOOGLE_CLIENT_ID", value = var.google_client_id },
      { name = "GOOGLE_CLIENT_SECRET", value = var.google_client_secret },
      { name = "GOOGLE_CALLBACK_URL", value = var.google_callback_url },
      { name = "FRONTEND_URL", value = var.frontend_url }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "backend"
      }
    }
  }])
}

# ECS Service
resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-${var.environment}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = var.assign_public_ip
  }

  # Register with Cloud Map for service discovery
  dynamic "service_registries" {
    for_each = var.service_discovery_arn != "" ? [1] : []
    content {
      registry_arn   = var.service_discovery_arn
      container_name = "backend"
      container_port = var.app_port
    }
  }

  # Allow external changes to desired_count without Terraform reverting them
  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }
}
