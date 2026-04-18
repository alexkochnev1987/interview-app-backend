provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

module "vpc" {
  source       = "../../modules/vpc"
  project_name = var.project_name
  environment  = var.environment
}

module "iam_oidc" {
  source       = "../../modules/iam-oidc"
  project_name = var.project_name
  environment  = var.environment
  github_org   = var.github_org
}

module "ecr" {
  source       = "../../modules/ecr"
  project_name = var.project_name
}

module "s3" {
  source               = "../../modules/s3"
  project_name         = var.project_name
  cors_allowed_origins = ["http://localhost:3000"]
}

module "rds" {
  source            = "../../modules/rds"
  project_name      = var.project_name
  environment       = var.environment
  instance_class    = "db.t4g.micro"
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_id = module.vpc.rds_security_group_id
  db_password       = var.db_password
}

module "api_gateway" {
  source            = "../../modules/api-gateway"
  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.public_subnet_ids
  security_group_id = module.vpc.ecs_security_group_id
}

module "ecs" {
  source                = "../../modules/ecs"
  project_name          = var.project_name
  environment           = var.environment
  ecr_repo_url          = module.ecr.repository_url
  s3_bucket_name        = module.s3.bucket_name
  subnet_ids            = module.vpc.public_subnet_ids
  security_group_id     = module.vpc.ecs_security_group_id
  cpu                   = 256
  memory                = 512
  desired_count         = 1
  assign_public_ip      = true
  service_discovery_arn = module.api_gateway.service_discovery_service_arn
  jwt_secret            = var.jwt_secret
  google_client_id      = var.google_client_id
  google_client_secret  = var.google_client_secret
  google_callback_url   = "https://develop.${module.amplify.default_domain}/api/auth/google/callback"
  frontend_url          = "https://develop.${module.amplify.default_domain}"
}

module "amplify" {
  source                = "../../modules/amplify"
  project_name          = var.project_name
  environment           = var.environment
  github_repository_url = "https://github.com/alexkochnev1987/interview-app-frontend"
  api_url               = module.api_gateway.api_url
}

module "stepfunctions" {
  source         = "../../modules/stepfunctions"
  project_name   = var.project_name
  environment    = var.environment
  s3_bucket_name = module.s3.bucket_name
}
