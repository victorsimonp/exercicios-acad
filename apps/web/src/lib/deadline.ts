export class ConnectionError extends Error {
  constructor(public kind: 'timeout' | 'network') {
    super(
      kind === 'timeout'
        ? 'O servidor demorou para responder.'
        : 'Não foi possível conectar. Verifique sua conexão com a internet.',
    );
  }
}

export function withDeadline<T>(
  operation: Promise<T>,
  milliseconds = 60000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    operation,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new ConnectionError('timeout')),
        milliseconds,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}
