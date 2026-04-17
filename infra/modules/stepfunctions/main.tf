# IAM role for Step Functions execution
resource "aws_iam_role" "stepfunctions" {
  name = "${var.project_name}-${var.environment}-stepfunctions"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "states.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "stepfunctions" {
  name = "${var.project_name}-${var.environment}-stepfunctions-policy"
  role = aws_iam_role.stepfunctions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = "arn:aws:lambda:*:*:function:${var.project_name}-${var.environment}-*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM role for Lambda functions
resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-${var.environment}-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda" {
  name = "${var.project_name}-${var.environment}-lambda-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "arn:aws:s3:::${var.s3_bucket_name}/${var.environment}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "transcribe:StartTranscriptionJob",
          "transcribe:GetTranscriptionJob"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = "*"
      }
    ]
  })
}

# Lambda functions — initially created with placeholder code
# Real code deployed via CI/CD
resource "aws_lambda_function" "process_interview" {
  function_name = "${var.project_name}-${var.environment}-process-interview"
  role          = aws_iam_role.lambda.arn
  handler       = "handler.handler"
  runtime       = "nodejs20.x"
  timeout       = 300
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      ENVIRONMENT  = var.environment
      S3_BUCKET    = var.s3_bucket_name
      S3_PREFIX    = "${var.environment}/"
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_function" "generate_report" {
  function_name = "${var.project_name}-${var.environment}-generate-report"
  role          = aws_iam_role.lambda.arn
  handler       = "handler.handler"
  runtime       = "nodejs20.x"
  timeout       = 300
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      ENVIRONMENT  = var.environment
      S3_BUCKET    = var.s3_bucket_name
      S3_PREFIX    = "${var.environment}/"
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

# Placeholder Lambda code for initial deployment
data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.module}/placeholder.zip"

  source {
    content  = "exports.handler = async (event) => ({ statusCode: 200, body: 'placeholder' });"
    filename = "handler.js"
  }
}

# CloudWatch log groups
resource "aws_cloudwatch_log_group" "process_interview" {
  name              = "/aws/lambda/${aws_lambda_function.process_interview.function_name}"
  retention_in_days = var.environment == "prod" ? 30 : 7
}

resource "aws_cloudwatch_log_group" "generate_report" {
  name              = "/aws/lambda/${aws_lambda_function.generate_report.function_name}"
  retention_in_days = var.environment == "prod" ? 30 : 7
}

# Step Functions state machine
resource "aws_sfn_state_machine" "interview_pipeline" {
  name     = "${var.project_name}-${var.environment}-interview-pipeline"
  role_arn = aws_iam_role.stepfunctions.arn

  definition = jsonencode({
    Comment = "Interview processing pipeline"
    StartAt = "ValidateAnswers"
    States = {
      ValidateAnswers = {
        Type     = "Task"
        Resource = aws_lambda_function.process_interview.arn
        Parameters = {
          "action"    = "validate"
          "input.$"   = "$"
        }
        ResultPath = "$.validation"
        Next       = "TranscribeAudio"
        Retry = [{
          ErrorEquals     = ["States.TaskFailed"]
          IntervalSeconds = 5
          MaxAttempts     = 2
          BackoffRate     = 2
        }]
        Catch = [{
          ErrorEquals = ["States.ALL"]
          ResultPath  = "$.error"
          Next        = "ProcessingFailed"
        }]
      }
      TranscribeAudio = {
        Type     = "Task"
        Resource = aws_lambda_function.process_interview.arn
        Parameters = {
          "action"    = "transcribe"
          "input.$"   = "$"
        }
        ResultPath = "$.transcription"
        Next       = "AnalyzeAnswers"
        Retry = [{
          ErrorEquals     = ["States.TaskFailed"]
          IntervalSeconds = 10
          MaxAttempts     = 3
          BackoffRate     = 2
        }]
        Catch = [{
          ErrorEquals = ["States.ALL"]
          ResultPath  = "$.error"
          Next        = "ProcessingFailed"
        }]
      }
      AnalyzeAnswers = {
        Type     = "Task"
        Resource = aws_lambda_function.generate_report.arn
        Parameters = {
          "action"    = "analyze"
          "input.$"   = "$"
        }
        ResultPath = "$.analysis"
        Next       = "ComputeScores"
        Retry = [{
          ErrorEquals     = ["States.TaskFailed"]
          IntervalSeconds = 5
          MaxAttempts     = 2
          BackoffRate     = 2
        }]
        Catch = [{
          ErrorEquals = ["States.ALL"]
          ResultPath  = "$.error"
          Next        = "ProcessingFailed"
        }]
      }
      ComputeScores = {
        Type     = "Task"
        Resource = aws_lambda_function.generate_report.arn
        Parameters = {
          "action"    = "score"
          "input.$"   = "$"
        }
        ResultPath = "$.scores"
        Next       = "AggregateResult"
        Retry = [{
          ErrorEquals     = ["States.TaskFailed"]
          IntervalSeconds = 5
          MaxAttempts     = 2
          BackoffRate     = 2
        }]
        Catch = [{
          ErrorEquals = ["States.ALL"]
          ResultPath  = "$.error"
          Next        = "ProcessingFailed"
        }]
      }
      AggregateResult = {
        Type     = "Task"
        Resource = aws_lambda_function.generate_report.arn
        Parameters = {
          "action"    = "aggregate"
          "input.$"   = "$"
        }
        ResultPath = "$.result"
        Next       = "ProcessingComplete"
        Retry = [{
          ErrorEquals     = ["States.TaskFailed"]
          IntervalSeconds = 5
          MaxAttempts     = 2
          BackoffRate     = 2
        }]
        Catch = [{
          ErrorEquals = ["States.ALL"]
          ResultPath  = "$.error"
          Next        = "ProcessingFailed"
        }]
      }
      ProcessingComplete = {
        Type = "Succeed"
      }
      ProcessingFailed = {
        Type  = "Fail"
        Error = "ProcessingError"
        Cause = "Interview processing pipeline failed"
      }
    }
  })

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.stepfunctions.arn}:*"
    include_execution_data = true
    level                  = "ERROR"
  }
}

resource "aws_cloudwatch_log_group" "stepfunctions" {
  name              = "/aws/states/${var.project_name}-${var.environment}-interview-pipeline"
  retention_in_days = var.environment == "prod" ? 30 : 7
}
