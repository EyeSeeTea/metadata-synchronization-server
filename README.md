## Setup

```
$ yarn install
```

## Development

Start development server:

```
$ yarn start
```

## Build executable

```
$ yarn dist
```

This will produce a bundled executable ```metadata-synchronization-server.js``` file that can be executed with ```node```.

## Configuration file

File `app-config.json` must be provided. If no configuration file is supplied the following is used as a placeholder:

```json
{
    "encryptionKey": "encryptionKey",
    "baseUrl": "https://play.dhis2.org/2.30",
    "username": "admin",
    "password": "district"
}

```
