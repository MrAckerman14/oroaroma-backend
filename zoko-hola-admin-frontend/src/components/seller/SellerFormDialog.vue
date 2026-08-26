<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card
      class="seller-form-dialog column no-wrap"
      :class="{ 'seller-form-dialog--mobile': $q.screen.lt.sm }"
    >
      <q-card-section class="row items-center no-wrap q-px-lg q-py-md bg-white">
        <q-avatar
          color="yellow-9"
          text-color="dark"
          :icon="isEdit ? 'edit_note' : 'person_add'"
        />
        <div class="q-ml-md">
          <div class="text-h6 text-weight-bold">
            {{ isEdit ? "Editar vendedor" : "Agregar vendedor" }}
          </div>
          <div class="text-caption text-grey-7">
            {{ isEdit ? "Actualiza los datos del vendedor." : "Registra un nuevo vendedor en el sistema." }}
          </div>
        </div>
        <q-space />
        <q-btn icon="close" flat round dense aria-label="Cerrar" @click="onReset" />
      </q-card-section>
      <q-separator />

      <q-form class="col column no-wrap" autocomplete="off" @submit.prevent="onSubmit" @reset="onReset">
        <q-card-section class="col scroll bg-grey-1 q-pa-lg">
          <q-card flat bordered class="seller-form-panel q-pa-md bg-white">
            <div class="row items-start q-gutter-sm q-mb-md">
              <q-icon name="badge" size="20px" color="grey-8" />
              <div>
                <div class="text-subtitle1 text-weight-bold">Información del vendedor</div>
                <div class="text-caption text-grey-7">Datos de acceso y rol dentro del equipo.</div>
              </div>
            </div>

            <div class="row q-col-gutter-md">
              <div class="col-12">
                <q-input
                  v-model="form.name"
                  outlined
                  color="black"
                  name="seller-name"
                  autocomplete="off"
                  label="Nombre completo *"
                  lazy-rules
                  :rules="[(val) => (val && val.length > 0) || 'Por favor escribe un nombre']"
                />
              </div>

              <div class="col-12">
                <q-input
                  v-model="form.email"
                  outlined
                  color="black"
                  type="email"
                  name="seller-email"
                  autocomplete="off"
                  label="Correo electrónico *"
                  lazy-rules
                  :rules="isEdit ? [] : [(val) => (val && val.length > 0) || 'Por favor escribe un correo']"
                />
              </div>

              <div class="col-12 col-sm-6">
                <q-input
                  v-model="form.password"
                  outlined
                  color="black"
                  type="password"
                  name="seller-password"
                  autocomplete="new-password"
                  label="Contraseña *"
                  lazy-rules
                  :rules="[(val) => (val !== null && val !== '') || 'Ingresa contraseña']"
                />
              </div>

              <div class="col-12 col-sm-6">
                <q-select
                  v-model="form.rol"
                  :options="rols"
                  outlined
                  color="black"
                  name="seller-role"
                  autocomplete="off"
                  label="Rol *"
                  lazy-rules
                  :rules="[(val) => (val !== null && val !== '') || 'Selecciona un rol']"
                />
              </div>
            </div>
          </q-card>
        </q-card-section>

        <q-separator />
        <q-card-actions align="right" class="q-px-lg q-py-md bg-white">
          <q-btn flat color="grey-8" label="Cancelar" type="reset" />
          <q-btn
            unelevated
            color="yellow-9"
            text-color="dark"
            :icon="isEdit ? 'save' : 'person_add'"
            :label="isEdit ? 'Guardar cambios' : 'Agregar vendedor'"
            type="submit"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  name: "SellerFormDialog",
  props: {
    modelValue: { type: Boolean, default: false },
    data: { type: Object, default: () => ({}) },
    rols: { type: Array, default: () => [] },
    isEdit: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "update:data", "submit", "reset"],
  computed: {
    form: {
      get() {
        return this.data;
      },
      set(value) {
        this.$emit("update:data", value);
      },
    },
  },
  methods: {
    onSubmit() {
      this.$emit("submit");
    },
    onReset() {
      this.$emit("reset");
    },
  },
};
</script>

<style scoped>
.seller-form-dialog {
  width: min(560px, 94vw);
  height: min(620px, calc(100vh - 32px));
  max-width: 560px;
  border-radius: 18px;
}

.seller-form-dialog--mobile {
  height: auto;
  max-height: calc(100vh - 32px);
  border-radius: 18px;
}

.seller-form-panel {
  border-radius: 16px;
}
</style>
