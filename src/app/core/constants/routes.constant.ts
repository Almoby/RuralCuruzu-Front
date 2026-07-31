export const APP_ROUTES = {
  root: '',
  auth: {
    root: 'auth',
    login: 'auth/login',
    register: 'auth/registro',
    forgotPassword: 'auth/recuperar-password',
    resetPassword: 'auth/restablecer-password',
    changePassword: 'auth/cambiar-password',
  },
  public: {
    respuestaSolicitud: 'respuesta-solicitud',
  },
  admin: {
    root: 'admin',
    dashboard: 'admin/dashboard',
    requests: 'admin/solicitudes',
    members: 'admin/socios',
    memberDetail: 'admin/socios/:id',
    fees: 'admin/cuotas',
    merchants: 'admin/comercios',
    reports: 'admin/reportes',
  },
  socio: {
    root: 'socio',
    dashboard: 'socio/panel',
    qr: 'socio/mi-qr',
    benefits: 'socio/beneficios',
    history: 'socio/historial',
    payments: 'socio/mis-pagos',
  },
  comercio: {
    root: 'comercio',
    home: 'comercio/inicio',
    promotions: 'comercio/promociones',
    validateQr: 'comercio/validar-qr',
    stats: 'comercio/estadisticas',
  },
} as const;
