variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "ecr_repo_url" {
  type = string
}

variable "s3_bucket_name" {
  type    = string
  default = ""
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "cpu" {
  type    = number
  default = 256  # 0.25 vCPU — smallest Fargate option
}

variable "memory" {
  type    = number
  default = 512  # 0.5 GB
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "app_port" {
  type    = number
  default = 3000
}

variable "assign_public_ip" {
  type    = bool
  default = false
}

variable "service_discovery_arn" {
  description = "Cloud Map service ARN for auto-registration"
  type        = string
  default     = ""
}

variable "jwt_secret" {
  type      = string
  default   = "change-me-in-production"
  sensitive = true
}

variable "google_client_id" {
  type    = string
  default = ""
}

variable "google_client_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "google_callback_url" {
  type    = string
  default = ""
}

variable "frontend_url" {
  type    = string
  default = ""
}

variable "database_url" {
  type      = string
  default   = ""
  sensitive = true
}
