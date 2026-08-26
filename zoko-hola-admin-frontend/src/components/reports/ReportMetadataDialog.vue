<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="report-metadata-dialog column no-wrap">
      <q-card-section class="row items-center no-wrap q-px-lg q-py-md bg-white">
        <q-avatar color="yellow-9" text-color="dark" icon="description" />
        <div class="q-ml-md">
          <div class="text-h6 text-weight-bold">{{ title }}</div>
          <div class="text-caption text-grey-7">Actualiza la identificacion y nota del reporte.</div>
        </div>
        <q-space />
        <q-btn icon="close" flat round dense aria-label="Cerrar" :disable="loading" @click="close" />
      </q-card-section>
      <q-separator />

      <q-form class="col column no-wrap" @submit.prevent="submit">
        <q-card-section class="col scroll bg-grey-1 q-pa-lg">
          <q-card flat bordered class="report-metadata-panel q-pa-md bg-white">
            <div class="row items-start q-gutter-sm q-mb-md">
              <q-icon name="edit_note" size="20px" color="grey-8" />
              <div>
                <div class="text-subtitle1 text-weight-bold">Informacion del reporte</div>
                <div class="text-caption text-grey-7">Usa un nombre claro para encontrarlo facilmente despues.</div>
              </div>
            </div>

            <div class="row q-col-gutter-md">
              <div class="col-12">
                <q-input
                  v-model="form.name"
                  outlined
                  color="black"
                  label="Nombre del reporte *"
                  lazy-rules
                  :rules="[(value) => Boolean(String(value || '').trim()) || 'Ingrese un nombre']"
                />
              </div>
              <div class="col-12">
                <q-input
                  v-model="form.note"
                  outlined
                  color="black"
                  type="textarea"
                  autogrow
                  label="Nota"
                  hint="Opcional: agrega un contexto breve para este reporte."
                />
              </div>
            </div>
          </q-card>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-px-lg q-py-md bg-white">
          <q-btn flat color="grey-8" label="Cancelar" :disable="loading" @click="close" />
          <q-btn unelevated color="yellow-9" text-color="dark" icon="save" label="Guardar cambios" type="submit" :loading="loading" :disable="loading" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  name: 'ReportMetadataDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: 'Editar reporte' },
    report: { type: Object, default: null },
    loading: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'submit', 'close'],
  data() {
    return { form: { name: '', note: '' } };
  },
  watch: {
    modelValue(value) {
      if (value) this.fillForm();
    },
    report: {
      handler() {
        if (this.modelValue) this.fillForm();
      },
      deep: true,
    },
  },
  methods: {
    fillForm() {
      this.form = { name: this.report?.name || '', note: this.report?.note || '' };
    },
    close() {
      if (this.loading) return;
      this.$emit('update:modelValue', false);
      this.$emit('close');
    },
    submit() {
      this.$emit('submit', { name: String(this.form.name || '').trim(), note: String(this.form.note || '').trim() });
    },
  },
};
</script>

<style scoped>
.report-metadata-dialog { width: min(560px, 94vw); height: min(600px, calc(100vh - 32px)); max-width: 560px; border-radius: 18px; }
.report-metadata-panel { border-radius: 16px; }
</style>
