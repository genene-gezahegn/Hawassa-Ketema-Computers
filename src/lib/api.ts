import { defaultInventory } from './inventory';
import type { Product } from './inventory';

const API_URL = (
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000/api' : '')
).replace(/\/+$/, '');
if (!API_URL) throw new Error('VITE_API_URL must be configured for production.');
export type ApiUser = { id:string; fullName:string; email:string; phone?:string|null; role:'admin'|'customer'|'employee'|'delivery_person' };
export class ApiRequestError extends Error {
 constructor(message:string,readonly status:number){super(message);this.name='ApiRequestError';}
}
export function getToken(){return localStorage.getItem('hk_access_token');}
export function saveSession(token:string,user:ApiUser){localStorage.setItem('hk_access_token',token);localStorage.setItem('hk_user',JSON.stringify(user));}
export function clearSession(){localStorage.removeItem('hk_access_token');localStorage.removeItem('hk_user');}
export async function apiRequest<T>(path:string,options:RequestInit={}):Promise<T>{
 const token=getToken();let response:Response;
 try{response=await fetch(`${API_URL}${path}`,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...options.headers}});}
 catch{throw new Error('Unable to connect to the store. Check your internet connection and try again.');}
 if(response.status===204)return undefined as T;const data=await response.json().catch(()=>({message:'Unexpected server response.'}));
 if(!response.ok){
  if(Array.isArray(data.errors)){
   const messages=data.errors.map((error:{field?:string;message?:string})=>{
    const field=String(error.field||'');
    if(field.endsWith('productId'))return 'Refresh your cart and choose the product again.';
    if(field.endsWith('quantity'))return 'Choose a whole-number quantity greater than zero.';
    if(field==='phone')return 'Use a valid Ethiopian phone number, such as 0912345678.';
    if(field==='customerName')return 'Enter your full name.';
    if(field==='deliveryAddress')return 'Enter a delivery address (at least 5 characters).';
    if(field==='paymentMethod')return 'Choose a supported payment method.';
    if(field==='items')return 'Your cart must contain at least one valid product.';
    return error.message||'Check the submitted information.';
   });
   throw new ApiRequestError([...new Set(messages)].join(' '),response.status);
  }
  throw new ApiRequestError(data.message||'Request failed.',response.status);
 }
 return data as T;
}

export async function loadApiProducts(){
 const {products}=await apiRequest<{products:Array<Record<string,unknown>>}>('/products');
 return products.map((p)=>({
  id:String(p.id),sku:String(p.sku),productCode:String(p.sku),name:String(p.name),productName:String(p.name),brand:String(p.brand||''),
  category:String(p.category||'Accessories') as import('./inventory').Category,model:String(p.model||''),condition:'Brand New' as const,
  specs:String(p.specs||''),price:Number(p.price),sellingPrice:Number(p.price),buyingPrice:Number(p.price)*0.8,stockQuantity:Number(p.stockQuantity||0),quantity:Number(p.stockQuantity||0),
  lowStockThreshold:Number(p.reorderLevel??5),minimumStockLevel:Number(p.reorderLevel??5),productPhoto:typeof p.productPhoto==='string'?p.productPhoto:undefined,
  notes:String(p.description||''),updatedAt:String(p.createdAt||new Date().toISOString())
 } as import('./inventory').Product));
}

const bundledProductIds = new Set(defaultInventory.map((product) => product.id));

export function getUnpublishedInventoryProducts(products: Product[]) {
 return products.filter((product) => product.id.startsWith('prod-') && !bundledProductIds.has(product.id));
}

export function toApiProductPayload(product: Product) {
 return {
  sku:product.sku,name:product.name,brand:product.brand,model:product.model,category:product.category,
  description:product.notes||'',specs:product.specs||'',price:product.price,stockQuantity:product.stockQuantity,
  reorderLevel:product.lowStockThreshold??5,productPhoto:product.productPhoto||null,
 };
}

export async function publishUnpublishedInventory(products: Product[]): Promise<Record<string, string>> {
 const unpublished=getUnpublishedInventoryProducts(products);
 if(unpublished.length===0)return {};
 if(!getToken())throw new Error('Sign in as an administrator before publishing inventory.');

 const {products:apiProducts}=await apiRequest<{products:Array<{id:string;sku:string}>}>('/products');
 const publishedIds:Record<string,string>={};
 for(const product of unpublished){
  const existing=apiProducts.find((item)=>item.sku===product.sku);
  const response=await apiRequest<{product:{id:string}}>(existing?`/products/${existing.id}`:'/products',{
   method:existing?'PATCH':'POST',
   body:JSON.stringify(toApiProductPayload(product)),
  });
  if(!response.product?.id)throw new Error(`The store did not return an ID for ${product.name}.`);
  publishedIds[product.id]=response.product.id;
 }
 return publishedIds;
}

export async function updateApiProductPhoto(id:string,productPhoto:string|null):Promise<void>{
 await apiRequest(`/products/${id}`,{method:'PATCH',body:JSON.stringify({productPhoto})});
}

export async function deactivateApiProduct(id:string):Promise<void>{
 await apiRequest<void>(`/products/${id}`,{method:'DELETE'});
}

export async function uploadPaymentReceipt(orderId:string, fields:{bank:string;reference:string;senderName:string;receipt?:File|null}) {
 let receiptData:string|undefined;let receiptMime:string|undefined;
 if(fields.receipt){
  if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(fields.receipt.type))throw new Error('Choose a JPG, PNG, WebP, or PDF receipt.');
  if(fields.receipt.size>5*1024*1024)throw new Error('Receipt file must be 5 MB or smaller.');
  receiptMime=fields.receipt.type;
  receiptData=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=()=>reject(new Error('Unable to read receipt file.'));reader.readAsDataURL(fields.receipt!);});
 }
 return apiRequest<{payment:{status:string};message:string}>(`/payments/orders/${orderId}/receipt`,{method:'POST',body:JSON.stringify({bank:fields.bank,reference:fields.reference,senderName:fields.senderName,receiptMime,receiptData})});
}

export async function updateProfile(fields: {
  fullName?: string;
  phone?: string | null;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}): Promise<{ user: ApiUser }> {
  return apiRequest<{ user: ApiUser }>('/auth/me', { method: 'PATCH', body: JSON.stringify(fields) });
}

export async function getCurrentUser(): Promise<ApiUser> {
  const { user } = await apiRequest<{ user: ApiUser }>('/auth/me');
  return user;
}

export async function getPaymentReceiptImage(paymentId:string):Promise<Blob>{
 const response=await fetch(`${API_URL}/payments/admin/${paymentId}/receipt`,{headers:getToken()?{Authorization:`Bearer ${getToken()}`} : {}});
 if(!response.ok)throw new Error('Unable to open receipt image.');return response.blob();
}
export async function getMyPaymentReceipt(orderId:string):Promise<Blob>{
 const response=await fetch(`${API_URL}/payments/orders/${orderId}/receipt`,{headers:getToken()?{Authorization:`Bearer ${getToken()}`} : {}});
 if(!response.ok)throw new Error('Unable to open this order receipt.');return response.blob();
}

// ── Staff management (admin) ──────────────────────────────────────────────────
export type DeliveryAssignmentPermission = 'ASSIGN_DELIVERIES' | 'REASSIGN_DELIVERIES' | 'VIEW_ALL_DELIVERIES';
export type StaffMember = { id:string; fullName:string; email:string; phone?:string|null; role:'employee'|'delivery_person'; isActive:boolean; createdAt:string; permissions?:DeliveryAssignmentPermission[] };
export async function listStaff():Promise<StaffMember[]>{ const d=await apiRequest<{staff:StaffMember[]}>('/staff'); return d.staff; }
export async function createStaff(fields:{fullName:string;email:string;phone?:string;role:'employee'|'delivery_person';password:string}):Promise<StaffMember>{ const d=await apiRequest<{staff:StaffMember}>('/staff',{method:'POST',body:JSON.stringify(fields)}); return d.staff; }
export async function updateStaff(id:string,fields:{fullName?:string;phone?:string|null;newPassword?:string}):Promise<StaffMember>{ const d=await apiRequest<{staff:StaffMember}>(`/staff/${id}`,{method:'PATCH',body:JSON.stringify(fields)}); return d.staff; }
export async function setStaffStatus(id:string,isActive:boolean):Promise<StaffMember>{ const d=await apiRequest<{staff:StaffMember}>(`/staff/${id}/status`,{method:'PATCH',body:JSON.stringify({isActive})}); return d.staff; }
export async function updateStaffPermissions(id:string,permissions:DeliveryAssignmentPermission[]):Promise<DeliveryAssignmentPermission[]>{ const d=await apiRequest<{permissions:DeliveryAssignmentPermission[]}>(`/staff/${id}/permissions`,{method:'PUT',body:JSON.stringify({permissions})}); return d.permissions; }
export async function listDeliveryPersons():Promise<{id:string;fullName:string;email:string;phone?:string|null}[]>{ const d=await apiRequest<{deliveryPersons:{id:string;fullName:string;email:string;phone?:string|null}[]}>('/staff/delivery-persons/available'); return d.deliveryPersons; }

// ── Delivery (admin assigns, delivery person updates) ─────────────────────────
export type DeliveryStatus = 'unassigned'|'assigned'|'accepted'|'out_for_delivery'|'delivered'|'failed'|'returned';
export type DeliveryOrder = {
 id:string;orderNumber:string;customerName:string;phone:string;deliveryAddress:string;status:string;
 deliveryStatus:DeliveryStatus;deliveryNote:string;failureReason:string;paymentMethod:string;paymentStatus:string;
 assignedAt?:string;acceptedAt?:string;outForDeliveryAt?:string;deliveredAt?:string;failedAt?:string;
 total:number;createdAt:string;items:{name:string;sku:string;quantity:number;unitPrice:number}[];
 deliveryPersonId?:string|null;deliveryPersonName?:string;deliveryPersonPhone?:string|null;
 customerConfirmationStatus?:CustomerDeliveryConfirmationStatus|null;customerConfirmedAt?:string|null;
 customerDeliveryIssue?:string|null;customerDeliveryIssueReportedAt?:string|null;
};
export async function listAllDeliveries():Promise<DeliveryOrder[]>{ const d=await apiRequest<{deliveries:DeliveryOrder[]}>('/delivery'); return d.deliveries; }
export type DeliveryAssignmentHistory = {id:string;fromStatus:string|null;toStatus:string;actionType:'ASSIGNED'|'REASSIGNED'|'UNASSIGNED'|'STATUS_CHANGED';actorRole:string;note:string;createdAt:string;assignedBy:string|null;previousDeliveryPerson:string|null;deliveryPerson:string|null};
export async function getDeliveryAssignmentHistory(orderId:string):Promise<DeliveryAssignmentHistory[]>{ const d=await apiRequest<{history:DeliveryAssignmentHistory[]}>(`/delivery/${orderId}/assignment-history`); return d.history; }
export async function assignDelivery(orderId:string,deliveryPersonId:string):Promise<{delivery:Partial<DeliveryOrder>}>{ return apiRequest('/delivery/'+orderId+'/assign',{method:'POST',body:JSON.stringify({deliveryPersonId})}); }
export async function unassignDelivery(orderId:string):Promise<{delivery:Partial<DeliveryOrder>}>{ return apiRequest('/delivery/'+orderId+'/assign',{method:'DELETE'}); }
export async function listMyDeliveries():Promise<DeliveryOrder[]>{ const d=await apiRequest<{deliveries:DeliveryOrder[]}>('/delivery/mine'); return d.deliveries; }
export async function updateDeliveryStatus(
 orderId:string,
 deliveryStatus:Exclude<DeliveryStatus,'unassigned'|'assigned'>,
 deliveryNote?:string,
 failureReason?:string,
):Promise<{delivery:Partial<DeliveryOrder>}>{
 return apiRequest('/delivery/'+orderId+'/status',{method:'PATCH',body:JSON.stringify({deliveryStatus,deliveryNote,failureReason})});
}

// ── Employee ──────────────────────────────────────────────────────────────────
export type EmployeeOrder = { id:string; orderNumber:string; customerName:string; phone:string; deliveryAddress:string; status:string; deliveryStatus:string; deliveryPersonId?:string|null; deliveryPersonName?:string|null; assignedAt?:string|null; customerConfirmationStatus?:CustomerDeliveryConfirmationStatus|null; customerConfirmedAt?:string|null; customerDeliveryIssue?:string|null; customerDeliveryIssueReportedAt?:string|null; paymentStatus:string; paymentMethod:string; total:number; createdAt:string; items:{productId:string;name:string;sku:string;quantity:number;unitPrice:number}[] };
export async function listEmployeeOrders():Promise<EmployeeOrder[]>{ const d=await apiRequest<{orders:EmployeeOrder[]}>('/employee/orders'); return d.orders; }
export async function updateEmployeeOrderStatus(id:string,status:'confirmed'|'processing'|'ready'):Promise<unknown>{ return apiRequest(`/employee/orders/${id}/status`,{method:'PATCH',body:JSON.stringify({status})}); }
export async function getEmployeeDashboard():Promise<{stats:{toProcess:number;inProgress:number;readyForDelivery:number}}>{ return apiRequest('/employee/dashboard'); }
export async function getEmployeePermissions():Promise<DeliveryAssignmentPermission[]>{ const d=await apiRequest<{permissions:DeliveryAssignmentPermission[]}>('/employee/permissions'); return d.permissions; }

// ── Customer order portal ─────────────────────────────────────────────────────
export async function getMyOrder(id: string): Promise<import('../components/customerStorefrontTypes').CustomerOrder> {
  type OrderResponse = Omit<import('../components/customerStorefrontTypes').CustomerOrder, 'address'> & { deliveryAddress: string };
  const d = await apiRequest<{ order: OrderResponse }>(`/orders/mine/${id}`);
  return { ...d.order, address: d.order.deliveryAddress };
}
export type OrderMessage = { id:string; message:string; senderRole:string; senderName:string; createdAt:string };
export async function listOrderMessages(orderId:string):Promise<OrderMessage[]> {
 const d=await apiRequest<{messages:OrderMessage[]}>(`/orders/${orderId}/messages`);
 return d.messages;
}
export async function sendOrderMessage(orderId:string,message:string):Promise<OrderMessage> {
 const d=await apiRequest<{message:OrderMessage}>(`/orders/${orderId}/messages`,{method:'POST',body:JSON.stringify({message})});
 return d.message;
}
export type CustomerDeliveryConfirmationStatus = 'awaiting_confirmation' | 'customer_confirmed' | 'issue_reported';
export type CustomerDeliveryConfirmationResponse =
  | { response: 'received' }
  | { response: 'not_received'; details: string };
export type CustomerDeliveryConfirmation = {
  id: string;
  orderNumber: string;
  deliveryStatus: string;
  customerConfirmationStatus: CustomerDeliveryConfirmationStatus;
  customerConfirmedAt: string | null;
  customerDeliveryIssue: string;
  customerDeliveryIssueReportedAt: string | null;
};
export async function respondToDeliveryConfirmation(
  id: string,
  payload: CustomerDeliveryConfirmationResponse,
): Promise<{ confirmation: CustomerDeliveryConfirmation; message: string; emailNotificationStatus?: string }> {
  return apiRequest(`/orders/mine/${id}/delivery-confirmation`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
export async function requestCancelOrder(id: string, reason: string): Promise<{ message: string }> {
  return apiRequest(`/orders/mine/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
}
export async function requestReturnOrder(id: string, payload: {
  items: { productId: string; name: string; quantity: number; reason: string }[];
  reason: string;
  description: string;
}): Promise<{ message: string }> {
  return apiRequest(`/orders/mine/${id}/return`, { method: 'POST', body: JSON.stringify(payload) });
}
export type OrderReturnRequest = { status:string; reason:string; description?:string; adminNote?:string };
export async function updateOrderAddress(id: string, fields: { deliveryAddress?: string; phone?: string }): Promise<unknown> {
  return apiRequest(`/orders/mine/${id}/address`, { method: 'PATCH', body: JSON.stringify(fields) });
}
export async function getOrderReturn(id: string): Promise<{ returnRequest: OrderReturnRequest | null }> {
  return apiRequest(`/orders/mine/${id}/return`);
}
