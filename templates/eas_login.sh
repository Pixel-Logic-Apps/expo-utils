#!/usr/bin/expect

# Defina as variáveis de login e senha aqui
set username "diegoadriian6@proton.me"
set password "Linux321!"

# Desativa o log para não mostrar as mensagens do spawn
log_user 0

# Executa o comando logout e verifica se foi bem-sucedido
spawn sh -c "eas logout >/dev/null 2>&1"
expect eof
set logout_status $::spawn_id

# Executa o comando login e verifica se foi bem-sucedido
spawn sh -c "eas login >/dev/null 2>&1"
expect "Email or username"
send "$username\r"
expect "Password"
send "$password\r"
set login_status $::spawn_id

# Permite que o login seja concluído
interact

# Ativa novamente o log para exibir mensagens de status
log_user 1

# Exibe uma mensagem para indicar o sucesso ou falha do logout e login
if {$logout_status != -1} {
    if {$login_status != -1} {
        puts "Login realizado com sucesso."
    } else {
        puts "Erro ao realizar login."
    }
} else {
    puts "Erro ao realizar logout."
}