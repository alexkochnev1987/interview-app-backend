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
