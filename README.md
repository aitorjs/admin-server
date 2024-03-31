# Admin-server
  ## Levantar postgreSQL const postgis usando docker:
    - ```sudo docker run --name postgres-postgis -p 5432:5432 --network network -e POSTGRES_PASSWORD=admin -d postgis/postgis```
    - ```sudo docker start postgres-postgis```
  ## Levantar API (hono -> 3000):
    - ```pnpm i```
    - ```pnpm dev```
    
## Docker 
  ### Levantar container de postgres usando docker
  - sudo docker run --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=admin -d postgres
  
  ### Levantar container de postgres con postgia usando docker
  - sudo docker run --name postgres-postgis -p 5432:5432 --network network -e POSTGRES_PASSWORD=admin -d postgis/postgis

  ###  Levantar container de mysql usando docker
  - sudo docker run --name mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=admin -d mysql:8.2
  - sudo docker start mysql

  ### Necesita node >=v21.6.0
  - Necesita esta versión para que podamos usar [Object.groupBy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy)

  ### Levantar container de postgres con postgis (3.4.1) usando docker
  - sudo docker network create network
  - sudo docker run --name postgres-postgis -p 5432:5432 --network network -e POSTGRES_PASSWORD=admin -d postgis/postgis

  - npm install prisma typescript ts-node @types/node --save-dev
  - npx prisma init
  - (add) .env
  - (add) modelo
  - npx prisma migrate dev --name init

  - Entrar en una tabla usando postbird. En query, ejecutar esta sentencia:
  ```CREATE EXTENSION postgis;```. ```SELECT PostGIS_Full_Version();``` o ```SELECT * FROM pg_available_extensions WHERE name = 'postgis';``` para ver que esta postgis instalado.


  ### Iniciar docker al iniciar/reiniciar servidor
  - sudo systemctl enable docker

  ## PostgreSQL
  ### Exportar estructura y datos

- ```sudo docker exec postgres-postgis pg_dump -U postgres -F t mydb | gzip >./backups/mydb-$(date +%Y-%m-%d).tar.gz```
  - ```sudo docker exec postgres-postgis pg_dump -U postgres -d mydb -f ./backups/mydb-$(date +%Y-%m-%d).tar.gz```
  - Comentar (--) las siguiente lineas con DROP DATABASE, CREATE DATABASE, ALTER DATABASE y \connect que son cuatro.
  - Quitar "$$PATH$$/" de las sentencias COPY
  - Copiar ficheros: ```tar -czvf ../../../backups/files$(date +%Y-%m-%d).tar.gz *``` y meterlo en mydb-$(date +%Y-%m-%d).tar.gz

  ### Importar estructura desde sql modificado de la exportación anterior

  - ```CREATE DATABASE [databaseName] WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';``` (usar postbird para ello)
  - ```sudo docker container exec -it postgres-postgis bash```
  - ```wget https://xxxx``` (https://www.file.io/)
  - ```tar -xvzf [filename]```
  - ```chmod 777 /*.dat```
  - Copiar los .dat a /var/lib/postgresql/data/ [more info](https://www.reddit.com/r/PostgreSQL/comments/xevh32/comment/ioo751f/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button): ```cp /*.dat /var/lib/postgresql/data/```
  - ```psql -U postgres mydb6 < restore.sql```

## Comandos de prisma
  - npm install prisma typescript ts-node @types/node --save-dev
  - npx prisma init
  - (add) .env
  - (add) modelo
  - Crear tablas y migration: npx prisma migrate dev --name init
  - En cada cambio del modelo: npx prisma migrate dev or npx prisma db push

  ## Comentarios

  - Login usando authjs se hace una la plantilla de servidor que viene por defecto porque no he sido capaz de sacarla de alli y que funcione en react. Me dice que no le mando csrf-token. No hay <Login> para react.
