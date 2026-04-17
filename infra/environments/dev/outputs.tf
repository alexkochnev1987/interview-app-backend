output "vpc_id" {
  value = module.vpc.vpc_id
}

output "ecr_repository_url" {
  value = module.ecr.repository_url
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}

output "ecs_service_name" {
  value = module.ecs.service_name
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}

output "s3_bucket_name" {
  value = module.s3.bucket_name
}

output "state_machine_arn" {
  value = module.stepfunctions.state_machine_arn
}

output "amplify_app_id" {
  value = module.amplify.app_id
}

output "amplify_default_domain" {
  value = module.amplify.default_domain
}

output "github_backend_role_arn" {
  value = module.iam_oidc.github_backend_role_arn
}

output "github_frontend_role_arn" {
  value = module.iam_oidc.github_frontend_role_arn
}

output "github_workflows_role_arn" {
  value = module.iam_oidc.github_workflows_role_arn
}
