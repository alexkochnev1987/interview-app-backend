data "aws_secretsmanager_secret_version" "github_token" {
  secret_id = var.github_token_secret_name
}

resource "aws_amplify_app" "frontend" {
  name         = "${var.project_name}-${var.environment}"
  repository   = var.github_repository_url
  access_token = data.aws_secretsmanager_secret_version.github_token.secret_string

  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
  EOT

  environment_variables = {
    NEXT_PUBLIC_API_URL = var.api_url
    NEXT_PUBLIC_ENV     = var.environment
  }

  platform = "WEB_COMPUTE"  # Required for SSR (Next.js)
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = var.environment == "prod" ? "main" : "develop"

  framework = "Next.js - SSR"
  stage     = var.environment == "prod" ? "PRODUCTION" : "DEVELOPMENT"

  environment_variables = {
    NEXT_PUBLIC_ENV = var.environment
  }
}
