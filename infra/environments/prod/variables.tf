variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "interview-app"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "github_org" {
  type = string
}

variable "db_password" {
  type      = string
  sensitive = true
}
