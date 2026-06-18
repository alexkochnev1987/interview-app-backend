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
  default = "db.t4g.micro" # Free tier eligible
}

variable "create_db_instance" {
  type    = bool
  default = true
}

variable "max_allocated_storage" {
  type    = number
  default = 30
}

variable "multi_az" {
  type    = bool
  default = false
}

variable "skip_final_snapshot" {
  type    = bool
  default = true
}

variable "backup_retention_period" {
  type    = number
  default = 1
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
