export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
    public readonly field?: string,
  ) {
    super(code);
    this.name = "DomainError";
  }
}

export function conflict(code: string, field?: string): never {
  throw new DomainError(code, 409, field);
}

export function notFound(code = "not-found"): never {
  throw new DomainError(code, 404);
}
