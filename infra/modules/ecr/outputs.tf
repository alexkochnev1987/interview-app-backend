output "repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "repository_name" {
  value = aws_ecr_repository.backend.name
}

output "registry_id" {
  value = aws_ecr_repository.backend.registry_id
}
