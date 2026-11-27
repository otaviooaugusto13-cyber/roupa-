// Instância do serviço de estoque ligada ao Firestore real.
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase.js';
import { criarServicoEstoque } from './stock-core.js';

export const estoque = criarServicoEstoque({ db, FieldValue, Timestamp });
export { EstoqueInsuficienteError } from './stock-core.js';
