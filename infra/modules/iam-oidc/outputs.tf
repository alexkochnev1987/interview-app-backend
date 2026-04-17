output "github_backend_role_arn" {
  value = aws_iam_role.github_backend.arn
}

output "github_frontend_role_arn" {
  value = aws_iam_role.github_frontend.arn
}

output "github_workflows_role_arn" {
  value = aws_iam_role.github_workflows.arn
}

output "oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.github.arn
}
