variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "github_repository_url" {
  description = "GitHub repository URL for Amplify auto-build"
  type        = string
}

variable "api_url" {
  description = "Backend API URL"
  type        = string
  default     = "http://localhost:3000"
}

variable "github_token_secret_name" {
  description = "AWS Secrets Manager secret name containing GitHub token"
  type        = string
  default     = "interview-app/github-token"
}
