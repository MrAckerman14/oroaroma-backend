<template>
  <q-table
    :rows="rows"
    :columns="columns"
    :filter="filter"
    row-key="id"
    binary-state-sort
    flat
    bordered
    :pagination="{
      rowsPerPage: 100
    }"
    :rows-per-page-options="[
      5,
      10,
      25,
      50,
      100,
      250,
      500,
      0
    ]"
  >
    <template #top-right>
      <q-input v-model="filter" dense outlined debounce="300" placeholder="Buscar">
        <template #append><q-icon name="search" /></template>
      </q-input>
    </template>

    <!-- ========================= -->
    <!-- ACCIONES -->
    <!-- ========================= -->

    <template #body-cell-actions="props">
      <q-td :props="props" class="text-center">
        <q-btn flat round icon="visibility" color="black" aria-label="Ver detalle" @click="$emit('open', props.row)" />
        <q-btn round flat icon="edit" color="yellow-9" aria-label="Editar" @click="$emit('edit', props.row)" />
        <q-btn round flat icon="delete" color="negative" aria-label="Eliminar" @click="$emit('delete', props.row)" />
      </q-td>
    </template>

  </q-table>
</template>

<script>
export default {
  name: "InventoryReportsTable",

  props: {
    rows: {
      type: Array,
      default: () => [],
    },
  },

  data() {
    const formatNumber = (value) =>
      new Intl.NumberFormat("es-DO", { maximumFractionDigits: 0 }).format(Number(value || 0));
    const formatMoney = (value) =>
      new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(Number(value || 0));

    return {
      filter: "",
      columns: [
        {
          name: "name",
          label: "Nombre",
          field: "name",
          align: "center",
          sortable: true,
        },

        {
          name: "createAt",
          label: "Fecha",
          field: "from",
          align: "center",
          sortable: true,
        },

        {
          name: "total_products",
          label: "Total Productos",
          field: "total_products",
          align: "center",
          format: formatNumber,
          sortable: true,
        },

        {
          name: "total_inventory_value",

          label: "Valor Inventario",

          field: "total_inventory_value",
          align: "center",
          format: formatMoney,
          sortable: true,
        },

        {
          name: "actions",
          label: "Opciones",
          field: "actions",
          align: "center",
        },
      ],
    };
  },
};
</script>
