<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue';
import { appTheme } from 'src/config/appTheme';

onMounted(() => {
  document.title = appTheme.name;
});
</script>
