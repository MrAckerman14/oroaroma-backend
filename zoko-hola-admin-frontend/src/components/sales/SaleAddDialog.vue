<template>
  <q-dialog
    :model-value="modelValue"
    :maximized="$q.screen.lt.sm"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="sale-add-dialog column no-wrap" :class="{ 'sale-add-dialog--mobile': $q.screen.lt.sm }">
      <q-card-section class="row items-center no-wrap q-px-lg q-py-md bg-white">
        <q-avatar color="yellow-9" text-color="dark" icon="receipt_long" />
        <div class="q-ml-md">
          <div class="text-h6 text-weight-bold">Nueva venta</div>
          <div class="text-caption text-grey-7">
            Registra el pago, la entrega y los productos.
          </div>
        </div>
        <q-space /><q-btn
          icon="close"
          flat
          round
          dense
          aria-label="Cerrar"
          @click="$emit('reset')"
        />
      </q-card-section>
      <q-separator />

      <q-form
        class="col column no-wrap"
        @submit="$emit('submit')"
        @reset="$emit('reset')"
      >
        <q-card-section
          class="col scroll bg-grey-1"
          :class="$q.screen.lt.sm ? 'q-pa-md' : 'q-pa-lg'"
        >
          <div class="row q-col-gutter-lg">
            <div class="col-12 col-md-7">
              <q-card
                flat
                bordered
                class="sale-add-panel q-pa-md bg-white"
              >
                <div class="row items-start q-gutter-sm q-mb-md">
                  <q-icon name="payments" size="20px" color="grey-8" />
                  <div>
                    <div class="text-subtitle1 text-weight-bold">Pago</div>
                    <div class="text-caption text-grey-7">
                      Indica cómo se recibió el pago de la venta.
                    </div>
                  </div>
                </div>
                <div class="row q-col-gutter-md">
                  <div class="col-12 col-sm-6">
                    <q-input
                      v-model="formData.amount_cash"
                      color="black"
                      mask="######"
                      outlined
                      label="Monto en efectivo"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <q-input
                      v-model="formData.amount_transfer"
                      color="black"
                      mask="######"
                      outlined
                      label="Monto por transferencia"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <q-input
                      v-model="formData.amount"
                      color="black"
                      mask="######"
                      outlined
                      disable
                      label="Monto total *"
                      lazy-rules
                      :rules="[
                        (val) =>
                          Number(val || 0) > 0 ||
                          'Ingrese monto efectivo o transferencia',
                      ]"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <q-input
                      v-model="formData.delivery_pay"
                      color="black"
                      mask="######"
                      outlined
                      label="Costo de envío *"
                      lazy-rules
                      :rules="[
                        (val) =>
                          (val !== null && val !== undefined && val !== '') ||
                          'Ingrese costo de envío',
                      ]"
                    />
                  </div>
                </div>
              </q-card>

              <q-card
                flat
                bordered
                class="sale-add-panel q-pa-md q-mt-lg bg-white"
              >
                <div class="row items-start q-gutter-sm q-mb-md">
                  <q-icon name="local_shipping" size="20px" color="grey-8" />
                  <div>
                    <div class="text-subtitle1 text-weight-bold">
                      Entrega y responsables
                    </div>
                    <div class="text-caption text-grey-7">
                      Completa los datos necesarios para coordinar el pedido.
                    </div>
                  </div>
                </div>
                <div class="row q-col-gutter-md">
                  <div class="col-12 col-sm-6">
                    <q-select
                      v-if="canSelectMessenger"
                      v-model="formData.messenger_id"
                      :options="userMessenger"
                      color="black"
                      outlined
                      label="Mensajero"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <q-select
                      v-if="canSelectSeller"
                      v-model="formData.seller_id"
                      :options="userSeller"
                      color="black"
                      outlined
                      clearable
                      label="Colaborador"
                      @clear="clearSellerSelection"
                      @update:model-value="setSellerSelection"
                    /><q-input
                      v-else-if="isSellerUser"
                      :model-value="assignedSellerLabel"
                      outlined
                      readonly
                      label="Colaborador"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <q-input
                      v-model="formData.phone"
                      color="black"
                      outlined
                      mask="(###)-###-####"
                      label="Contacto *"
                      lazy-rules
                      :rules="[
                        (val) => !!val || 'Ingrese contacto',
                        (val) => val.length === 14 || 'Número incompleto',
                      ]"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <q-select
                      v-if="canSelectEmployee"
                      v-model="formData.employee_id"
                      :options="userEmployer"
                      color="black"
                      outlined
                      label="Vendedor"
                      ><template #append
                        ><q-icon
                          class="cursor-pointer"
                          name="close"
                          @click.stop.prevent="
                            formData.employee_id = ''
                          " /></template
                    ></q-select>
                  </div>
                  <div class="col-12">
                    <q-input
                      v-model="formData.location_url"
                      color="black"
                      outlined
                      label="Ubicación"
                    />
                  </div>
                  <div class="col-12">
                    <q-input
                      v-model="formData.description"
                      color="black"
                      outlined
                      type="textarea"
                      autogrow
                      label="Descripción"
                    />
                  </div>
                </div>
              </q-card>
            </div>

            <div class="col-12 col-md-5">
              <q-card
                flat
                bordered
                class="sale-add-panel bg-white"
              >
                <q-card-section class="q-pb-sm"
                  ><div class="row items-center no-wrap">
                    <div>
                      <div class="text-subtitle1 text-weight-bold">
                        Productos
                      </div>
                      <div class="text-caption text-grey-7">
                        {{ formData.detail.length }} productos, {{ totalSelectedQuantity }} unidades
                      </div>
                    </div>
                    <q-space /><q-btn
                      color="yellow-9"
                      text-color="black"
                      icon="add"
                      label="Agregar"
                      unelevated
                      @click="$emit('open-products')"
                    /></div
                ></q-card-section>
                <q-separator />
                <q-card-section
                  class="sale-add-product-list q-pa-none scroll"
                >
                  <div
                    v-if="!formData.detail.length"
                    class="q-pa-xl text-center text-grey-7"
                  >
                    <q-icon name="inventory_2" size="40px" />
                    <div class="text-weight-medium q-mt-sm">
                      Aún no hay perfumes agregados.
                    </div>
                    <div class="text-caption q-mt-xs">
                      Usa el botón Agregar para incluirlos en la venta.
                    </div>
                  </div>
                  <q-list v-else separator
                    ><q-item
                      v-for="item in formData.detail"
                      :key="item.product_id"
                      class="q-py-md"
                      ><q-item-section avatar
                        ><q-avatar size="48px" rounded
                          ><img
                            :src="
                              assetUrl(item.image_path, api.defaults.baseURL)
                            "
                            class="sale-add-product-image" /></q-avatar></q-item-section
                      ><q-item-section
                        ><q-item-label class="text-weight-bold">{{
                          item.name
                        }}</q-item-label
                        ><q-item-label caption
                          >Unidades seleccionadas</q-item-label
                        ></q-item-section
                      ><q-item-section side
                        ><div class="sale-add-quantity-stepper row items-center no-wrap">
                          <q-btn
                            icon="remove"
                            color="negative"
                            flat
                            dense
                            size="sm"
                            aria-label="Reducir cantidad"
                            @click="removeAmountProduct(item.product_id)"
                          /><q-input
                            v-model="item.quantity"
                            class="sale-add-quantity-stepper__input"
                            type="number"
                            borderless
                            dense
                          /><q-btn
                            icon="add"
                            color="blue"
                            flat
                            dense
                            size="sm"
                            aria-label="Aumentar cantidad"
                            @click="addAmountProduct(item.product_id)"
                          /></div></q-item-section></q-item
                  ></q-list>
                </q-card-section>
              </q-card>
            </div>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-px-lg q-py-md bg-white"
          ><q-btn label="Cancelar" type="reset" color="negative" flat /><q-btn
            label="Guardar venta"
            type="submit"
            color="yellow-9"
            text-color="black"
            icon="save"
        /></q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script>
import { api } from "src/boot/axios";
import { assetUrl } from "src/services/apiAdapters";
export default {
  name: "SaleAddDialog",
  props: {
    modelValue: { type: Boolean, default: false },
    formData: { type: Object, required: true },
    userMessenger: { type: Array, default: () => [] },
    userEmployer: { type: Array, default: () => [] },
    userSeller: { type: Array, default: () => [] },
    canSelectMessenger: { type: Boolean, default: false },
    canSelectEmployee: { type: Boolean, default: false },
    canSelectSeller: { type: Boolean, default: false },
    isSellerUser: { type: Boolean, default: false },
    assignedSellerLabel: { type: String, default: "" },
  },
  emits: ["update:modelValue", "submit", "reset", "open-products"],
  data() {
    return { api };
  },
  computed: {
    totalSelectedQuantity() {
      return this.formData.detail.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
      );
    },
  },
  methods: {
    assetUrl,
    clearSellerSelection() {
      this.formData.seller_id = null;
      this.formData.sellerId = null;
      this.formData.sellerCleared = true;
    },
    setSellerSelection(value) {
      if (value && typeof value === "object") {
        this.formData.seller_id = value;
        this.formData.sellerId = value.value;
        this.formData.sellerCleared = false;
        return;
      }
      if (!value) this.clearSellerSelection();
    },
    addAmountProduct(productId) {
      const index = this.formData.detail.findIndex(
        (p) => p.product_id === productId
      );
      if (index !== -1) this.formData.detail[index].quantity++;
    },
    removeAmountProduct(productId) {
      const index = this.formData.detail.findIndex(
        (p) => p.product_id === productId
      );
      if (index !== -1) {
        if (this.formData.detail[index].quantity > 1)
          this.formData.detail[index].quantity--;
        else this.formData.detail.splice(index, 1);
      }
    },
  },
};
</script>

<style scoped>
.sale-add-dialog {
  width: min(1120px, 96vw);
  height: min(820px, calc(100vh - 32px));
  max-width: 1120px;
  border-radius: 18px;
}

.sale-add-dialog--mobile {
  border-radius: 0;
}

.sale-add-panel {
  border-radius: 18px;
}

.sale-add-product-list {
  max-height: 410px;
}

.sale-add-product-image {
  object-fit: cover;
}

.sale-add-quantity-stepper {
  min-height: 36px;
  overflow: hidden;
  border: 1px solid #d9dce1;
  border-radius: 10px;
  background: #fff;
}

.sale-add-quantity-stepper__input {
  width: 42px;
  border-right: 1px solid #edf0f2;
  border-left: 1px solid #edf0f2;
}

.sale-add-quantity-stepper__input :deep(.q-field__control) {
  min-height: 34px;
  height: 34px;
}

.sale-add-quantity-stepper__input :deep(input) {
  width: 100%;
  padding: 0;
  text-align: center;
  font-weight: 700;
  appearance: textfield;
  -moz-appearance: textfield;
}

.sale-add-quantity-stepper__input :deep(input::-webkit-inner-spin-button),
.sale-add-quantity-stepper__input :deep(input::-webkit-outer-spin-button) {
  margin: 0;
  -webkit-appearance: none;
}

@media (max-width: 599px) {
  .sale-add-product-list {
    max-height: none;
  }
}
</style>
