docker exec c1bf0366ed4b ps aux
docker exec -it postgres psql -U postgres -c "ALTER ROLE newapi_user RENAME TO newapi;"
docker exec -it postgres psql -U postgres -c "\l newapi"
docker exec -it postgres psql -U postgres -c "ALTER USER newapi_user WITH PASSWORD 'aetherai@newapi8864'"
docker exec -it kong-database psql -U postgres -c "SELECT rolname FROM pg_roles WHERE rolname = 'newapi';"
docker compose -f compose-kong.yml down -v --remove-orphans
docker compose -f db.yml down -v --remove-orphans
