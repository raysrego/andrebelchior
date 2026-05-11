/*
  # Criar usuário Rosimar

  Cria o usuário inicial para acesso ao módulo Rosimar com email
  andrebelchior3@gmail.com e senha Andre19@
*/

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'andrebelchior3@gmail.com') THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'andrebelchior3@gmail.com',
      crypt('Andre19@', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      'andrebelchior3@gmail.com',
      jsonb_build_object('sub', v_user_id::text, 'email', 'andrebelchior3@gmail.com'),
      'email',
      now(),
      now(),
      now()
    );
  END IF;
END $$;
