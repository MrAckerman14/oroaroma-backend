<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="delete-confirm-dialog">
      <q-card-section class="row items-center no-wrap q-px-lg q-py-md">
        <q-avatar color="red-1" text-color="negative" icon="delete_outline" />
        <div class="q-ml-md">
          <div class="text-h6 text-weight-bold">Eliminar {{ itemType }}</div>
          <div class="text-caption text-grey-7">Esta acción no se puede deshacer.</div>
        </div>
        <q-space />
        <q-btn flat round dense icon="close" aria-label="Cerrar" :disable="loading" @click="$emit('update:modelValue', false)" />
      </q-card-section>

      <q-separator />

      <q-card-section class="q-px-lg q-py-md">
        <div class="text-body1">¿Deseas eliminar este {{ itemType.toLowerCase() }}?</div>
        <q-banner rounded class="bg-red-1 text-red-10 q-mt-md">
          <template #avatar><q-icon name="warning_amber" /></template>
          <span class="text-weight-bold">{{ itemName || 'Sin nombre' }}</span>
        </q-banner>
      </q-card-section>

      <q-card-actions align="right" class="q-px-lg q-py-md">
        <q-btn flat color="grey-8" label="Cancelar" :disable="loading" @click="$emit('update:modelValue', false)" />
        <q-btn unelevated color="negative" icon="delete" label="Eliminar" :loading="loading" @click="$emit('confirm')" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  name: "DeleteConfirmDialog",
  props: {
    modelValue: { type: Boolean, default: false },
    itemName: { type: String, default: "" },
    itemType: { type: String, default: "elemento" },
    loading: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "confirm"],
};
</script>

<style scoped>
.delete-confirm-dialog {
  width: min(420px, 92vw);
  border-radius: 18px;
}
</style>
