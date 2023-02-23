import {useEffect} from 'react';
import {z} from 'zod';
import {useAxios, AxiosRequestConfig, AxiosResponse, Options} from './useAxios';
import useUpdateRef from './utils/useUpdateRef';

class ValidationError<T, D> extends z.ZodError {
  response: AxiosResponse<T, D>;
  constructor(issues: z.ZodIssue[], response: AxiosResponse<T, D>) {
    super(issues);
    this.response = response;
  }
}

const useValidatedAxios = <T = unknown, D = unknown, R = AxiosResponse<T, D>>(
  config: AxiosRequestConfig<D>,
  options?: Options,
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

  useEffect(() => {
    const responseInterceptor = responseInterceptors.use(r => {
      if (validationSchemaRef.current) {
        try {
          const validatedData = validationSchemaRef.current.parse(r.data);
          r.data = validatedData;
        } catch (e) {
          if (e instanceof z.ZodError) {
            return Promise.reject(new ValidationError<unknown, D>(e.issues, r));
          }
          return Promise.reject(new ValidationError<unknown, D>([], r));
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
    fetch,
    fetchAsync,
    cancel,
    requestInterceptors,
    responseInterceptors,
  };
};

export {useValidatedAxios, ValidationError};
