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
