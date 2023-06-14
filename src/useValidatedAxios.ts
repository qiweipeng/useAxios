import {useEffect} from 'react';
import {z} from 'zod';
import {generateMock} from '@anatine/zod-mock';
import {useAxios, AxiosRequestConfig, AxiosResponse, Options} from './useAxios';
import useUpdateRef from './utils/useUpdateRef';

class ValidationError<T, D> extends z.ZodError {
  response: AxiosResponse<T, D>;
  constructor(issues: z.ZodIssue[], response: AxiosResponse<T, D>) {
    super(issues);
    this.name = 'ValidationError';
    this.response = response;
  }
}

interface ValidationOptions extends Options {
  mock?: boolean; // default is false
}

const useValidatedAxios = <T = unknown, D = unknown, R = AxiosResponse<T, D>>(
  config: AxiosRequestConfig<D>,
  options?: ValidationOptions,
  validationSchema?: z.Schema<T>,
) => {
  const {
    response,
    error,
    loading,
    fetch,
    fetchAsync,
    cancel,
    requestInterceptors,
    responseInterceptors,
  } = useAxios<T, D, R>(config, options);

  const validationSchemaRef = useUpdateRef(validationSchema);
  const optionsRef = useUpdateRef(options);

  useEffect(() => {
    const responseInterceptor = responseInterceptors.use(
      r => {
        if (validationSchemaRef.current) {
          try {
            const validatedData =
              optionsRef.current?.mock === true
                ? generateMock(validationSchemaRef.current)
                : validationSchemaRef.current.parse(r.data);
            r.data = validatedData;
          } catch (e) {
            if (e instanceof z.ZodError) {
              return Promise.reject(
                new ValidationError<unknown, D>(e.issues, r),
              );
            }
            return Promise.reject(new ValidationError<unknown, D>([], r));
          }
        }
        return r;
      },
      e => {
        if (optionsRef.current?.mock === true && validationSchemaRef.current) {
          return {status: 200, data: generateMock(validationSchemaRef.current)};
        }
        return Promise.reject(e);
      },
    );
    return () => {
      responseInterceptors.eject(responseInterceptor);
    };
  }, [optionsRef, responseInterceptors, validationSchemaRef]);

  return {
    response,
    error,
    loading,
    fetch,
    fetchAsync,
    cancel,
    requestInterceptors,
    responseInterceptors,
  };
};

export type {ValidationOptions};
export {useValidatedAxios, ValidationError};
