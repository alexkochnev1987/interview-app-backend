variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "instance_class" {
  type    = string
  default = "db.t4g.micro"  # Free tier eligible
}

variable "db_username" {
  type    = string
  default = "interview_app"
}

variable "db_password" {
  description = "Database password — pass via TF_VAR_db_password env var, never commit"
  type        = string
  sensitive   = true
}
