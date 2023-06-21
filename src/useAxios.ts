import {
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useReducer,
  Reducer,
} from 'react';
import axios, {
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  Cancel,
  AxiosInterceptorManager,
} from 'axios';
import useUpdateRef from './utils/useUpdateRef';

type State<T, D, R = AxiosResponse<T, D>> = {
  response?: R;
  error?: AxiosError<unknown, D> | Error | Cancel;
  loading: boolean;
};

type Action<T, D, R = AxiosResponse<T, D>> = {
  type: 'start' | 'resolve' | 'reject';
  response?: R;
  error?: AxiosError<unknown, D> | Error | Cancel;
};

function reducer<T, D, R>(state: State<T, D, R>, action: Action<T, D, R>) {
  switch (action.type) {
    case 'start':
      return {
        ...state,
        loading: true,
      };
    case 'resolve':
      return {
        response: action.response,
        error: undefined,
        loading: false,
      };
    case 'reject':
      return {
        ...state,
        error: action.error,
        loading: false,
      };
  }
}

const initialState = {
  response: undefined,
  error: undefined,
  loading: false,
};

type Options = {
  manual?: boolean; // default is true
  loadingDelay?: number; // default is 0
};

const useAxios = <T = unknown, D = unknown, R = AxiosResponse<T, D>>(
  config: AxiosRequestConfig<D>,
  options?: Options,
): {
  response?: R;
  error?: AxiosError<unknown, D> | Error | Cancel;
  loading: boolean;
  fetch: (config?: AxiosRequestConfig<D>) => void;
  fetchAsync: (config?: AxiosRequestConfig<D>) => Promise<R>;
  cancel: () => void;
  requestInterceptors: AxiosInterceptorManager<AxiosRequestConfig<D>>;
  responseInterceptors: AxiosInterceptorManager<AxiosResponse<T, D>>;
} => {
  const [state, dispatch] = useReducer<
    Reducer<State<T, D, R>, Action<T, D, R>>
  >(reducer, initialState);

  const configRef = useUpdateRef(config);
  const optionsRef = useUpdateRef(options);

  const instance = useMemo(() => axios.create(), []);
  const abortControllerRef = useRef<AbortController>();

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const fetchAsync = useCallback(
    async (c?: AxiosRequestConfig<D>) => {
      const timeout = setTimeout(() => {
        dispatch({type: 'start'});
      }, optionsRef.current?.loadingDelay ?? 0);
      cancel();
      try {
        abortControllerRef.current = new AbortController();
        const r = await instance.request<T, R, D>({
          signal: abortControllerRef.current.signal,
          ...configRef.current,
          ...c,
          params: c?.params
            ? {...configRef.current.params, ...c.params}
            : configRef.current.params,
          data:
            c?.data === undefined || c.data === null
              ? configRef.current.data
              : typeof c.data === 'object' &&
                c.data instanceof FormData === false
              ? {...configRef.current.data, ...c.data}
              : c.data,
        });
        clearTimeout(timeout);
        dispatch({type: 'resolve', response: r});
        return r;
      } catch (e) {
        clearTimeout(timeout);
        dispatch({
          type: 'reject',
          error: e as AxiosError<unknown, D> | Error | Cancel,
        });
        return Promise.reject(e);
      }
    },
    [cancel, configRef, instance, optionsRef],
  );
  const fetch = useCallback(
    (c?: AxiosRequestConfig<D>) => {
      fetchAsync(c).catch(() => {
        return;
      });
    },
    [fetchAsync],
  );

  useEffect(() => {
    if (optionsRef.current?.manual === false) {
      setTimeout(() => {
        fetch();
      }, 0);
    }
  }, [fetch, optionsRef]);

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    response: state.response,
    error: state.error,
    loading: state.loading,
    fetch,
    fetchAsync,
    cancel,
    requestInterceptors: instance.interceptors.request,
    responseInterceptors: instance.interceptors.response,
  };
};

const isCancel = axios.isCancel;
const isAxiosError = axios.isAxiosError;

export type {
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  Cancel,
  AxiosInterceptorManager,
  Options,
};
export {useAxios, isCancel, isAxiosError};
