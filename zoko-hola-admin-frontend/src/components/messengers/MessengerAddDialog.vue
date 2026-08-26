<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="messenger-form-dialog column no-wrap" :class="{ 'messenger-form-dialog--mobile': $q.screen.lt.sm }">
      <q-card-section class="row items-center no-wrap q-px-lg q-py-md bg-white">
        <q-avatar color="yellow-9" text-color="dark" :icon="isEdit ? 'edit_note' : 'local_shipping'" />
        <div class="q-ml-md">
          <div class="text-h6 text-weight-bold">{{ isEdit ? 'Editar mensajero' : 'Agregar mensajero' }}</div>
          <div class="text-caption text-grey-7">{{ isEdit ? 'Actualiza la informacion del mensajero.' : 'Registra un nuevo mensajero en el sistema.' }}</div>
        </div>
        <q-space />
        <q-btn icon="close" flat round dense aria-label="Cerrar" :disable="loading" @click="reset" />
      </q-card-section>
      <q-separator />

      <q-form class="col column no-wrap" autocomplete="off" @submit.prevent="submit" @reset="reset">
        <q-card-section class="col scroll bg-grey-1 q-pa-lg">
          <q-card flat bordered class="messenger-form-panel q-pa-md bg-white">
            <div class="row items-start q-gutter-sm q-mb-md">
              <q-icon name="local_shipping" size="20px" color="grey-8" />
              <div>
                <div class="text-subtitle1 text-weight-bold">Informacion del mensajero</div>
                <div class="text-caption text-grey-7">Datos de acceso para gestionar sus entregas.</div>
              </div>
            </div>

            <div class="row q-col-gutter-md">
              <div class="col-12">
                <q-input v-model="form.name" outlined color="black" name="messenger-name" autocomplete="off" label="Nombre completo *" lazy-rules :rules="[(val) => (val && val.length > 0) || 'Por favor escribe un nombre']" />
              </div>
              <div class="col-12">
                <q-input v-model="form.email" outlined color="black" type="email" name="messenger-email" autocomplete="off" label="Correo electronico *" lazy-rules :rules="isEdit ? [] : [(val) => (val && val.length > 0) || 'Por favor escribe un correo']" />
              </div>
              <div class="col-12">
                <q-input v-model="form.password" outlined color="black" type="password" name="messenger-password" autocomplete="new-password" label="Contrasena *" lazy-rules :rules="[(val) => (val !== null && val !== '') || 'Ingresa contrasena']" />
              </div>
            </div>
          </q-card>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-px-lg q-py-md bg-white">
          <q-btn flat color="grey-8" label="Cancelar" type="reset" :disable="loading" />
          <q-btn unelevated color="yellow-9" text-color="dark" :icon="isEdit ? 'save' : 'person_add'" :label="isEdit ? 'Guardar cambios' : 'Agregar mensajero'" type="submit" :loading="loading" :disable="loading" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  name: 'MessengerAddDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    formData: { type: Object, required: true },
    isEdit: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'update:formData', 'submit', 'reset'],
  computed: {
    form: {
      get() { return this.formData; },
      set(value) { this.$emit('update:formData', value); },
    },
  },
  methods: {
    submit() { this.$emit('submit'); },
    reset() { this.$emit('reset'); },
  },
};
</script>

<style scoped>
.messenger-form-dialog { width: min(560px, 94vw); height: min(620px, calc(100vh - 32px)); max-width: 560px; border-radius: 18px; }
.messenger-form-dialog--mobile { height: auto; max-height: calc(100vh - 32px); border-radius: 18px; }
.messenger-form-panel { border-radius: 16px; }
</style>
