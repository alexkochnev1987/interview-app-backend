variable "project_name" {
  type = string
}

variable "cors_allowed_origins" {
  description = "Allowed origins for CORS (frontend URLs)"
  type        = list(string)
  default     = ["http://localhost:3000"]
}
