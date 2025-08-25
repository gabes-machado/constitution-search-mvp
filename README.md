# Constitution Search MVP

## Description

Constitution Search MVP is a NestJS application that scrapes the Brazilian Constitution and indexes it in a Typesense database.
Its main use case is to provide a search interface for the Brazilian Constitution.

This MVP is a proof of concept for a larger project that will be used to search for constitutional articles and brazilian laws in general.

This project is also optimized to be used as a microservice, with the ability to be scaled horizontally.

AI usage is recommended and encouraged, all core functions are documented and each file has context on how to use it, to leverage AI capabilities and human readability.

## Project setup

```bash
$ npm install
```

Set the environment variables in the `.env` file.

```bash
$ cp .env.example .env
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- Visit the [Typesense Documentation](https://typesense.org/docs) to learn more about the Typesense search engine.
- Visit the [Redis Documentation](https://redis.io/docs) to learn more about the Redis database.

- Visit the [Cheerio Documentation](https://cheerio.js.org) to learn more about the Cheerio library.
- Visit the [Passport Documentation](https://github.com/jaredhanson/passport) to learn more about the Passport library.
- Visit the [JWT Documentation](https://github.com/auth0/node-jsonwebtoken) to learn more about the JWT library.

## Contributing and AI

Check out our `CONTRIBUTING.md` file for more information on how to contribute to this project and leverage the use of AI.

## License
