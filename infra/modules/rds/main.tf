resource "aws_db_subnet_group" "main" {
  count = var.create_db_instance ? 1 : 0

  name       = "${var.project_name}-${var.environment}"
  subnet_ids = var.subnet_ids

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  }
}

resource "aws_db_instance" "main" {
  count = var.create_db_instance ? 1 : 0

  identifier = "${var.project_name}-${var.environment}"

  engine         = "postgres"
  engine_version = "16.4"
  instance_class = var.instance_class

  allocated_storage     = 20
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"

  db_name  = replace("${var.project_name}_${var.environment}", "-", "_")
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main[0].name
  vpc_security_group_ids = [var.security_group_id]

  multi_az            = var.multi_az
  publicly_accessible = false
  skip_final_snapshot = var.skip_final_snapshot

  backup_retention_period = var.backup_retention_period

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }
}
