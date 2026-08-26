<template>
  <div class="fullscreen flex flex-center bg-black">
    <div class="login border-rounded q-pa-md">
      <div class="login-header column">
        <div class="login-avatar">
          <img :src="appTheme.logo" :alt="appTheme.name" />
        </div>
        <div class="login-title text-h4 text-bold text-center">{{ appTheme.name }}</div>
        <div class="text-h6 text-bold text-center q-mb-md text-white">
          Login
        </div>
      </div>

      <q-form class="login-form column" @submit.prevent="login">
        <q-input
          class="q-mx-md"
          dense
          color="amber-7"
          bg-color="white"
          rounded
          outlined
          v-model="email"
          label="Correo"
          type="email"
          lazy-rules
          :rules="[(val) => !!val || 'Ingresa tu correo']"
        />

        <q-input
          class="q-mx-md"
          dense
          color="amber-7"
          bg-color="white"
          rounded
          outlined
          v-model="password"
          label="Contrasena"
          type="password"
          lazy-rules
          :rules="[(val) => !!val || 'Ingresa tu contrasena']"
        />

        <q-btn
          rounded
          class="q-pa-sm q-mx-xl"
          label="Iniciar sesion"
          type="submit"
          unelevated
          :loading="loading"
          :disable="loading"
        />
      </q-form>
    </div>
  </div>
</template>

<script>
import { Cookies, Notify } from "quasar";
import { api } from "boot/axios";
import { apiErrorMessage } from "src/services/apiAdapters";
import { roleFromUser, useAuthStore } from "src/stores/auth";
import { appTheme } from "src/config/appTheme";

export default {
  name: "LoginView",

  data() {
    return {
      email: "",
      password: "",
      loading: false,
      appTheme,
      auth: null,
    };
  },

  created() {
    this.auth = useAuthStore();
  },

  methods: {
    async login() {
      if (this.loading) return;
      this.loading = true;

      try {
        this.auth.clearSession();

        const response = await api.post("/auth/login", {
          email: this.email,
          password: this.password,
        });

        const session = response.data?.data || response.data;
        const user = session.user;
        const role = roleFromUser(user);
        const roleKey =
          user?.roles?.[0]?.roleKey || user?.roles?.[0]?.key || user?.roleKey;

        Cookies.set("token", session.accessToken || session.token, {
          expires: 7,
        });

        if (session.refreshToken) {
          Cookies.set("refresh_token", session.refreshToken, {
            expires: 30,
          });
        }

        this.auth.setSession(user.name, role, user.id, roleKey);
        await this.$router.replace("/");
      } catch (err) {
        Notify.create({
          type: "negative",
          message: apiErrorMessage(err, "Datos incorrectos"),
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.login {
  height: auto;
  border: 2px solid var(--app-primary);
  border-radius: 20px;
  padding: 20px;
}

.login-title {
  color: var(--app-primary);
}

.login-avatar {
  position: relative;
  display: flex;
  justify-content: center;
  top: -9vh;
  height: 72px;
}

.login-avatar img {
  height: 128px;
  width: auto;
  border: 4px solid var(--app-primary);
  border-radius: 100%;
}

.login-form .q-input >>> .q-field__inner.relative-position.col.self-stretch {
  border: 1px solid var(--app-primary);
  border-radius: 32px;
}

.login-form .q-btn {
  background: var(--app-primary);
  color: var(--app-ink);
}
</style>
