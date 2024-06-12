import { validateBody } from '../../decorators/index.js';
import {
  userSignInSchema,
  userSignUpSchema,
  userVerifySchema,
} from '../../schemas/user-schema.js';

const userSignUpValidate = validateBody(userSignUpSchema);
const userSignInValidate = validateBody(userSignInSchema);
const userEmailValidate = validateBody(userVerifySchema);

export default {
  userSignUpValidate,
  userSignInValidate,
  userEmailValidate,
};
