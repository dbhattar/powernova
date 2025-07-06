## Setting up for Local Development

Follow each steps below.

### 1. Basic Setup

- Install [docker](https://docs.docker.com/get-docker/) and [docker-compose](https://docs.docker.com/compose/install/)
- Clone the repository: `$ git clone git@github.com:Cosmic-Global-Technologies/prototype-backend.git`.
- `$ cd prototype-backend`
- Copy `.env.sample` as `.env` and fill up the necessary fields.
- Build docker images `$ docker compose build`
- Run: `$ docker-compose up`. This should run the server at port `8000`.

### 2. Apply Migrations

- `$ docker-compose exec server python manage.py migrate`

### 3. Create superuser

- `$ docker-compose exec server python manage.py createsuperuser`

## Notes

- Make sure to install GDAL, GEOS, Proj
- If they are in non standard locations, set the GDAL_LIBRARY_PATH, GEOS_LIBRARY_PATH, and potentially PROJ_LIBRARY_PATH environment variables to point to the actual library