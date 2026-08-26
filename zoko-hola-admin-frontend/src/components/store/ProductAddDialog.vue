<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="product-form-dialog column no-wrap" :class="{ 'product-form-dialog--mobile': $q.screen.lt.sm }">
      <q-card-section class="row items-center no-wrap q-px-lg q-py-md bg-white">
        <q-avatar color="yellow-9" text-color="dark" :icon="isEdit ? 'edit_note' : 'inventory_2'" />
        <div class="q-ml-md">
          <div class="text-h6 text-weight-bold">{{ isEdit ? 'Editar producto' : 'Agregar producto' }}</div>
          <div class="text-caption text-grey-7">{{ isEdit ? 'Actualiza la informacion y existencia del producto.' : 'Registra un producto para el inventario.' }}</div>
        </div>
        <q-space />
        <q-btn icon="close" flat round dense aria-label="Cerrar" :disable="loading" @click="reset" />
      </q-card-section>
      <q-separator />

      <q-form class="col column no-wrap" autocomplete="off" @submit.prevent="submit" @reset="reset">
        <q-card-section class="col scroll bg-grey-1 q-pa-lg">
          <q-card flat bordered class="product-form-panel q-pa-md bg-white">
            <div class="row items-start q-gutter-sm q-mb-md">
              <q-icon name="inventory_2" size="20px" color="grey-8" />
              <div>
                <div class="text-subtitle1 text-weight-bold">Informacion del producto</div>
                <div class="text-caption text-grey-7">Nombre e imagen que se mostraran en el almacen.</div>
              </div>
            </div>
            <div class="row q-col-gutter-lg items-stretch">
              <div class="col-12 col-sm-6 column q-gutter-md">
                <q-input v-model="data.name" outlined color="black" name="product-name" autocomplete="off" label="Nombre del producto *" lazy-rules :rules="[(val) => (val && val.length > 0) || 'Ingrese un nombre']" />

                <q-file ref="imageFileInput" v-model="data.file" outlined color="black" :label="isEdit ? 'Cambiar imagen del producto' : 'Imagen del producto'" :display-value="imageFileLabel" accept="image/*" clearable>
                  <template #prepend><q-icon name="image" /></template>
                </q-file>
              </div>

              <div class="col-12 col-sm-6">
                <q-card flat bordered class="product-image-preview column items-center justify-center q-pa-sm" role="button" tabindex="0" @click="openImagePicker" @keyup.enter="openImagePicker">
                  <q-img v-if="imagePreviewUrl" class="product-current-image" :src="imagePreviewUrl" spinner-color="yellow-9" fit="contain" />
                  <q-img v-else-if="isEdit && data.image_path" class="product-current-image" :src="getAssetUrl(data.image_path)" spinner-color="yellow-9" fit="contain" />
                  <div v-else class="column items-center justify-center text-center text-grey-6 q-pa-md">
                    <q-icon name="image" size="42px" color="grey-5" />
                    <div class="text-caption q-mt-sm">Selecciona una imagen para verla aqui.</div>
                  </div>
                </q-card>
              </div>
            </div>
          </q-card>

          <q-card flat bordered class="product-form-panel q-pa-md bg-white q-mt-md">
            <div class="row items-start q-gutter-sm q-mb-md">
              <q-icon name="sell" size="20px" color="grey-8" />
              <div>
                <div class="text-subtitle1 text-weight-bold">Precios y existencia</div>
                <div class="text-caption text-grey-7">Define los valores y unidades disponibles.</div>
              </div>
            </div>
            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-6">
                <q-input v-model="data.purchase_price" outlined color="black" type="number" min="0" step="0.01" label="Precio de compra *" lazy-rules :rules="[(val) => (val !== null && val !== '') || 'Ingrese el precio de compra']" />
              </div>
              <div class="col-12 col-sm-6">
                <q-input v-model="data.sale_price" outlined color="black" type="number" min="0" step="0.01" label="Precio de venta *" lazy-rules :rules="[(val) => (val !== null && val !== '') || 'Ingrese el precio de venta']" />
              </div>
              <div class="col-12">
                <q-input v-model="data.stock" outlined color="black" type="number" min="0" step="1" label="Stock disponible *" lazy-rules :rules="[(val) => (val !== null && val !== '') || 'Ingrese el stock']">
                  <template #prepend><q-icon name="inventory" /></template>
                </q-input>
              </div>
            </div>
          </q-card>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-px-lg q-py-md bg-white">
          <q-btn flat color="grey-8" label="Cancelar" type="reset" :disable="loading" />
          <q-btn unelevated color="yellow-9" text-color="dark" :icon="isEdit ? 'save' : 'add_box'" :label="isEdit ? 'Guardar cambios' : 'Agregar producto'" type="submit" :loading="loading" :disable="loading" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script>
import { api } from 'src/boot/axios';
import { assetUrl } from 'src/services/apiAdapters';

export default {
  name: 'ProductAddDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    data: { type: Object, required: true },
    isEdit: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'submit', 'reset'],
  data() {
    return { imagePreviewUrl: '' };
  },
  computed: {
    imageFileLabel() {
      if (this.data.file instanceof File) return this.data.file.name;
      if (!this.isEdit || !this.data.image_path) return '';

      const path = String(this.data.image_path).split('?')[0];
      return decodeURIComponent(path.split('/').pop() || 'Imagen actual');
    },
  },
  watch: {
    'data.file'(file) {
      this.clearImagePreview();
      if (file instanceof File) this.imagePreviewUrl = URL.createObjectURL(file);
    },
  },
  beforeUnmount() {
    this.clearImagePreview();
  },
  methods: {
    getAssetUrl(path) { return assetUrl(path, api.defaults.baseURL); },
    openImagePicker() { this.$refs.imageFileInput?.pickFiles(); },
    clearImagePreview() {
      if (this.imagePreviewUrl) URL.revokeObjectURL(this.imagePreviewUrl);
      this.imagePreviewUrl = '';
    },
    submit() { this.$emit('submit'); },
    reset() { this.$emit('reset'); },
  },
};
</script>

<style scoped>
.product-form-dialog { width: min(680px, 94vw); height: min(760px, calc(100vh - 32px)); max-width: 680px; border-radius: 18px; }
.product-form-dialog--mobile { height: auto; max-height: calc(100vh - 32px); border-radius: 18px; }
.product-form-panel { border-radius: 16px; }
.product-image-preview { min-height: 148px; height: 148px; border-radius: 14px; cursor: pointer; }
.product-current-image { width: 100%; height: 160px; border-radius: 10px; }
</style>
