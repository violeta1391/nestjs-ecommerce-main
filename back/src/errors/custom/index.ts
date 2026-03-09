export interface ErrorBody extends Error {
  code: string;
}

export const errorMessages = {
  auth: {
    wronCredentials: {
      message: 'Wrong credentials provided',
      code: '401', 
    },
    userAlreadyExist: {
      message: 'User already exists',
      code: '409', 
    },
    expiredToken: {
      message: 'Token expired',
      code: '401', 
    },
    invlidToken: {
      message: 'Invalid token',
      code: '401', 
    },
    notAllowed: {
      message: 'You do not have permission to perform this action',
      code: '403', 
    },
  },
  user: {
    notFound: {
      message: 'User not found',
      code: '404',
    },
  },
  role: {
    notFound: {
      message: 'Role not found',
      code: '404',
    },
  },
  category: {
    notFound: {
      message: 'Category not found',
      code: '404', 
    },
  },
  product: {
    notFound: {
      message: 'Product not found',
      code: '404', 
    },
    notFulfilled: {
      message: 'Product information is incomplete',
      code: '400', 
    },
  },
  global: {
    internalError: {
      message: 'An internal server error occurred',
      code: '500', 
    },
  },
};