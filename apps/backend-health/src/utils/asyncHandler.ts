import { NextFunction, Request, Response, RequestHandler } from 'express';

/**
 * Fase 3 (Resolución de F-08):
 * En Express 4, las promesas rechazadas en controladores async no son capturadas
 * automáticamente por el router y dejan la conexión HTTP colgada hasta el timeout
 * del cliente. Este wrapper reenvía cualquier rechazo a `next(err)` para que el
 * middleware global de errores responda con 500 JSON de inmediato.
 */
export function asyncHandler<T extends Request = Request>(
    fn: (req: T, res: Response, next: NextFunction) => Promise<any>
): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req as T, res, next)).catch(next);
    };
}
