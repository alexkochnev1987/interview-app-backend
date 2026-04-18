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
  vpc_cidr     = "10.1.0.0/16"
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
  cors_allowed_origins = ["https://your-domain.com"]
}

module "rds" {
  source            = "../../modules/rds"
  project_name      = var.project_name
  environment       = var.environment
  instance_class    = "db.t4g.small"
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_id = module.vpc.rds_security_group_id
  db_password       = var.db_password
}

module "ecs" {
  source            = "../../modules/ecs"
  project_name      = var.project_name
  environment       = var.environment
  ecr_repo_url      = module.ecr.repository_url
  s3_bucket_name    = module.s3.bucket_name
  subnet_ids        = module.vpc.public_subnet_ids
  security_group_id = module.vpc.ecs_security_group_id
  cpu               = 256
  memory            = 512
  desired_count     = 0  # Stopped for MVP. Set to 1 when needed.
  database_url      = format(
    "postgresql://interview_app:%s@%s:%s/%s",
    urlencode(var.db_password),
    module.rds.address,
    module.rds.port,
    module.rds.db_name,
  )
}

module "amplify" {
  source                = "../../modules/amplify"
  project_name          = var.project_name
  environment           = var.environment
  github_repository_url = "https://github.com/alexkochnev1987/interview-app-frontend"
  api_url               = "http://${module.ecs.service_name}.prod.internal:3000"
}

module "stepfunctions" {
  source         = "../../modules/stepfunctions"
  project_name   = var.project_name
  environment    = var.environment
  s3_bucket_name = module.s3.bucket_name
}
