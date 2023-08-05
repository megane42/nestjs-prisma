import {
  ArgumentsHost,
  Catch,
  ContextType,
  HttpException,
  HttpServer,
  HttpStatus,
} from '@nestjs/common';
import { APP_FILTER, BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

export declare type GqlContextType = 'graphql' | ContextType;

export type ErrorCodesStatusMapping = {
  [key: string]: number;
};

export type ErrorCodesMessageMapping = {
  [key: string]: string;
};

/**
 * {@link PrismaClientExceptionFilter} catches {@link Prisma.PrismaClientKnownRequestError} exceptions.
 */
@Catch(Prisma?.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter extends BaseExceptionFilter {
  /**
   * default error codes mapping
   *
   * Error codes definition for Prisma Client (Query Engine)
   * @see https://www.prisma.io/docs/reference/api-reference/error-reference#prisma-client-query-engine
   */
  private errorCodesStatusMapping: ErrorCodesStatusMapping = {
    P2000: HttpStatus.BAD_REQUEST,
    P2002: HttpStatus.CONFLICT,
    P2025: HttpStatus.NOT_FOUND,
  };

  /**
   * default error messages mapping
   *
   * Error codes definition for Prisma Client (Query Engine)
   * @see https://www.prisma.io/docs/reference/api-reference/error-reference#prisma-client-query-engine
   */
  private errorCodesMessageMapping: ErrorCodesMessageMapping = {};

  /**
   * @param applicationRef
   * @param errorCodesStatusMapping
   * @param errorCodesMessageMapping
   */
  constructor(
    applicationRef?: HttpServer,
    errorCodesStatusMapping: ErrorCodesStatusMapping | null = null,
    errorCodesMessageMapping: ErrorCodesMessageMapping | null = null,
  ) {
    super(applicationRef);

    // use custom error codes mapping (overwrite)
    //
    // @example:
    //
    //   const { httpAdapter } = app.get(HttpAdapterHost);
    //   app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter, {
    //     P2022: HttpStatus.BAD_REQUEST,
    //   }));
    //
    if (errorCodesStatusMapping) {
      this.errorCodesStatusMapping = Object.assign(
        this.errorCodesStatusMapping,
        errorCodesStatusMapping,
      );
    }

    // use custom error messages mapping (overwrite)
    //
    // @example:
    //
    //   const { httpAdapter } = app.get(HttpAdapterHost);
    //   app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter, {
    //     P2000: HttpStatus.BAD_REQUEST,
    //     P2025: HttpStatus.NOT_FOUND,
    //   }, {
    //     // You can omit some message mappings (e.g. for `P2025: ...` here) so that the default ones are used.
    //     P2000: "something went wrong",
    //   }));
    //
    if (errorCodesMessageMapping) {
      this.errorCodesMessageMapping = Object.assign(
        this.errorCodesMessageMapping,
        errorCodesMessageMapping,
      );
    }
  }

  /**
   * @param exception
   * @param host
   * @returns
   */
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    return this.catchClientKnownRequestError(exception, host);
  }

  private catchClientKnownRequestError(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ) {
    const statusCode = this.errorCodesStatusMapping[exception.code];
    const message =
      this.errorCodesMessageMapping[exception.code] ||
      this.defaultExceptionMessage(exception);

    if (host.getType() === 'http') {
      if (!Object.keys(this.errorCodesStatusMapping).includes(exception.code)) {
        return super.catch(exception, host);
      }

      return super.catch(
        new HttpException({ statusCode, message }, statusCode),
        host,
      );
    } else if (host.getType<GqlContextType>() === 'graphql') {
      // for graphql requests
      if (!Object.keys(this.errorCodesStatusMapping).includes(exception.code)) {
        return exception;
      }

      return new HttpException({ statusCode, message }, statusCode);
    }
  }

  private defaultExceptionMessage(
    exception: Prisma.PrismaClientKnownRequestError,
  ): string {
    const shortMessage = exception.message.substring(
      exception.message.indexOf('→'),
    );
    return (
      `[${exception.code}]: ` +
      shortMessage
        .substring(shortMessage.indexOf('\n'))
        .replace(/\n/g, '')
        .trim()
    );
  }
}

export function providePrismaClientExceptionFilter(
  errorCodesStatusMapping?: ErrorCodesStatusMapping,
  errorCodesmessageMapping?: ErrorCodesMessageMapping,
) {
  return {
    provide: APP_FILTER,
    useFactory: ({ httpAdapter }: HttpAdapterHost) => {
      return new PrismaClientExceptionFilter(
        httpAdapter,
        errorCodesStatusMapping,
        errorCodesmessageMapping,
      );
    },
    inject: [HttpAdapterHost],
  };
}
