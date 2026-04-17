# GitHub Actions OIDC provider — allows GitHub to authenticate with AWS
# without storing static credentials
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# IAM role for backend CI/CD (ECR push + ECS deploy)
resource "aws_iam_role" "github_backend" {
  name = "${var.project_name}-${var.environment}-github-backend"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.project_name}-backend:*"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_backend" {
  name = "${var.project_name}-${var.environment}-backend-deploy"
  role = aws_iam_role.github_backend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:DeregisterTaskDefinition"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = "*"
        Condition = {
          StringLike = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:ListTasks",
          "ecs:DescribeTasks"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeNetworkInterfaces"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "amplify:UpdateApp",
          "amplify:StartJob"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM role for frontend CI/CD (Amplify deploy)
resource "aws_iam_role" "github_frontend" {
  name = "${var.project_name}-${var.environment}-github-frontend"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.project_name}-frontend:*"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_frontend" {
  name = "${var.project_name}-${var.environment}-frontend-deploy"
  role = aws_iam_role.github_frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "amplify:StartDeployment",
          "amplify:CreateDeployment",
          "amplify:GetApp",
          "amplify:GetBranch",
          "amplify:ListApps",
          "amplify:ListBranches"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM role for workflows CI/CD (Lambda + Step Functions deploy)
resource "aws_iam_role" "github_workflows" {
  name = "${var.project_name}-${var.environment}-github-workflows"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.project_name}-workflows:*"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_workflows" {
  name = "${var.project_name}-${var.environment}-workflows-deploy"
  role = aws_iam_role.github_workflows.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:UpdateFunctionCode",
          "lambda:UpdateFunctionConfiguration",
          "lambda:GetFunction",
          "lambda:ListFunctions"
        ]
        Resource = "arn:aws:lambda:*:*:function:${var.project_name}-${var.environment}-*"
      },
      {
        Effect = "Allow"
        Action = [
          "states:UpdateStateMachine",
          "states:DescribeStateMachine",
          "states:ListStateMachines"
        ]
        Resource = "*"
      }
    ]
  })
}
