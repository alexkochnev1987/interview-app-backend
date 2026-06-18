output "endpoint" {
  value = try(aws_db_instance.main[0].endpoint, null)
}

output "address" {
  value = try(aws_db_instance.main[0].address, null)
}

output "port" {
  value = try(aws_db_instance.main[0].port, null)
}

output "db_name" {
  value = try(aws_db_instance.main[0].db_name, null)
}
