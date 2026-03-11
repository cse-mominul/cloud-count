#!/bin/sh

# Wait for MongoDB to be ready
echo "Waiting for MongoDB to be ready..."

# Try to connect using nc (netcat)
until nc -z db 27017; do
  echo "MongoDB is unavailable - sleeping"
  sleep 2
done

echo "MongoDB is up - executing command"
