import {useEffect} from 'react';
import * as yup from 'yup';
import {
  useAxios,
  isCancel,
  isAxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  Cancel,
  Options,
  AxiosInterceptorManager,
} from './useAxios';
import useUpdateRef from './utils/useUpdateRef';

class ValidationError<T, D> extends Error {
  response: AxiosResponse<T, D>;
  constructor(
    name: string,
    message: string,
    response: AxiosResponse<T, D>,
    stack?: string,
  ) {
    super();
    this.name = name;
    this.message = message;
    this.response = response;
    this.stack = stack;
  }
}

const useValidatedAxios = <T = unknown, D = unknown, R = AxiosResponse<T, D>>(
  config: AxiosRequestConfig<D>,
  options?: Options,
  validationSchema?: yup.BaseSchema,
): {
  response?: R;
  error?: ValidationError<unknown, D> | AxiosError<unknown, D> | Error | Cancel;
  loading: boolean;
  fetchData: (config?: AxiosRequestConfig<D>) => void;
  fetchDataAsync: (config?: AxiosRequestConfig<D>) => Promise<R>;
  cancel: () => void;
  requestInterceptors: AxiosInterceptorManager<AxiosRequestConfig<D>>;
  responseInterceptors: AxiosInterceptorManager<AxiosResponse<T, D>>;
} => {
  const {
    response,
    error,
    loading,
    fetchData,
    fetchDataAsync,
    cancel,
    requestInterceptors,
    responseInterceptors,
  } = useAxios<T, D, R>(config, options);

  const validationSchemaRef = useUpdateRef(validationSchema);

  useEffect(() => {
    const responseInterceptor = responseInterceptors.use(r => {
      if (validationSchemaRef.current) {
        try {
          const validatedData = validationSchemaRef.current.validateSync(
            r.data,
          );
          r.data = validatedData;
        } catch (e) {
          if (e instanceof yup.ValidationError) {
            return Promise.reject(
              new ValidationError<unknown, D>(e.name, e.message, r, e.stack),
            );
          }
          return Promise.reject(
            new ValidationError<unknown, D>(
              'OtherValidationError',
              'unkonwn validation error',
              r,
            ),
          );
        }
      }
      return r;
    });
    return () => {
      responseInterceptors.eject(responseInterceptor);
    };
  }, [responseInterceptors, validationSchemaRef]);

  return {
    response,
    error,
    loading,
    fetchData,
    fetchDataAsync,
    cancel,
    requestInterceptors,
    responseInterceptors,
  };
};

export type {
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  Cancel,
  AxiosInterceptorManager,
  Options,
};
export {useValidatedAxios, isCancel, isAxiosError, ValidationError};
