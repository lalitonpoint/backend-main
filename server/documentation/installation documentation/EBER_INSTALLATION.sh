#!/bin/bash
SLEEP_TIMES=1
PRODUCT_NAME="OnPoint"

# Supported Ubuntu versions
SUPPORTED_UBUNTU_VERSIONS=("16.04" "18.04" "20.04" "22.04")

NODE_VERSIONS_OPTIONS=("16.x" "18.x")
MONGO_VERSIONS_OPTIONS=("4.4" "5.0" "6.0")
REPO_ACTIONS_OPTIONS=("Install dependancy" "Install intial data(If the repo is BACKEND)" "Start PM2 server" "Build project" "EXIT")

DISTRIB_ID=$(grep DISTRIB_ID /etc/lsb-release | cut -d= -f2-)
DISTRIB_RELEASE=$(grep DISTRIB_RELEASE /etc/lsb-release | cut -d= -f2-)
DISTRIB_CODENAME=$(grep DISTRIB_CODENAME /etc/lsb-release | cut -d= -f2-)
DISTRIB_DESCRIPTION=$(grep DISTRIB_DESCRIPTION /etc/lsb-release | cut -d= -f2-)

# Define color codes
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
RESET='\033[37m'
CYAN='\033[36m'

# Welcome message
welcome_message(){
    echo -e "${YELLOW} Welcome to the ${PRODUCT_NAME} installer script!\n ${RESET}"
    sleep $SLEEP_TIMES

    echo -e "${YELLOW} This script will help you install all necessary dependancies of ${PRODUCT_NAME}.\n\n ${RESET}"
    sleep $SLEEP_TIMES
}

# Check if DISTRIB_RELEASE is in SUPPORTED_UBUNTU_VERSIONS
check_support() {
    if grep -q "$DISTRIB_RELEASE" <<< "${SUPPORTED_UBUNTU_VERSIONS[*]}"; then
        echo -e "${CYAN} The distribution $DISTRIB_RELEASE is supported."
        welcome_message
        installtion_choice
    else
        echo -e "${RED} The distribution $DISTRIB_DESCRIPTION is not supported.${RESET}"
        exit 1
    fi
    sleep $SLEEP_TIMES
}

# Update package lists
update_packages(){
    echo -e "${CYAN} 1-> Updating package lists...\n${RESET}"
    sudo apt-get update
    echo -e "${CYAN} \n End->1 Package lists updated.${RESET}"
    sleep $SLEEP_TIMES
}

#uninstall nodejs
uninstall_nodejs(){
    echo -e "${CYAN} \n Uninstalling previous Node.js version ${RESET}"
    sudo apt-get remove nodejs npm node -y
    sudo apt-get purge nodejs -y
    echo -e "${CYAN} \n check NodeJS is installed or not ${RESET} \n"
    sudo node -v
    sleep $SLEEP_TIMES
}

# Get NodeJS version input
nodejs_version_input(){
    echo -e "${CYAN} 2-> Please select NodeJS Version\n ${RESET}"
    select opt in "${NODE_VERSIONS_OPTIONS[@]}"; do
        case $opt in
            "16.x")
                NODE_VERSION="16.x"
                break
                ;;
            "18.x")
                NODE_VERSION="18.x"
                break
                ;;
             "20.x")
                NODE_VERSION="18.x"
                break
                ;;
                 "22.x")
                NODE_VERSION="18.x"
                break
                ;;
            *) echo -e "${RED} Invalid option";;
        esac
    done
    echo -e "${GREEN} \n You have selected NodeJS Version : $NODE_VERSION\n${RESET}"
    sleep $SLEEP_TIMES

}

# Install Node.js
install_nodejs(){
    echo -e "${CYAN} \n Installing Node.js version $NODE_VERSION\n${RESET}"
    sudo apt-get update
    curl -sL "https://deb.nodesource.com/setup_${NODE_VERSION}" | sudo -E bash -
    sudo apt-get install -y nodejs
    echo -e "${CYAN} \n End->2 Node.js version $NODE_VERSION installed successfully.${RESET}"
    sleep $SLEEP_TIMES
}

# Check Installed Node.js
check_node_version(){
    echo -e "${CYAN} \n Finding Installed NodeJS version${RESET}\n"
    sudo node -v
    sleep $SLEEP_TIMES
}

#Setup node with install, prevoius node version remove
setup_nodejs(){
    uninstall_nodejs
    nodejs_version_input
    install_nodejs
    check_node_version
}

# Install AngularJS
setup_angular(){
    echo -e "${CYAN} \n 3-> Installing AngularJS ${RESET}\n"
    sudo npm install -g @angular/cli
    echo -e "${CYAN} \n End->3 Angular Installed Successfully.${RESET}"
    sleep $SLEEP_TIMES
}

# Install Nginx
setup_nginx(){
    echo -e "${CYAN} \n 4-> Installing Nginx... \n${RESET}"
    sudo apt-get update
    sudo apt-get install -y nginx
    sudo ufw app list
    sudo ufw allow 'Nginx Full'
    echo -e "${GREEN} \n Nginx installed.${RESET}"
    sleep $SLEEP_TIMES

    #Give Permission
    echo -e "${CYAN} \n Give permission to access nginx... \n${RESET}"
    sudo chmod -R 777 /etc/nginx
    echo -e "${GREEN} \n Permission given to nginx.${RESET}"
    sleep $SLEEP_TIMES

    #Enable Nginx to start on boot
    echo -e "${CYAN} \n Enabling Nginx to start on boot... \n${RESET}"
    sudo systemctl enable nginx
    echo -e "${GREEN} \n Nginx enabled to start on boot.${RESET}"
    sleep $SLEEP_TIMES

    # Status Nginx
    echo -e "${CYAN} \n Getting status of Nginx... \n${RESET}"
    sudo systemctl status nginx
    sleep $SLEEP_TIMES

    # Configure http block
    new_lines="\    client_max_body_size 25M;\n    underscores_in_headers on;"
    existLine="client_max_body_size 25M"
    if ! sudo grep -q "$existLine" /etc/nginx/nginx.conf; then
    	echo -e "${CYAN} \n Configuring http block... \n${RESET}"
    	sudo sed -i '/http {/a '"$new_lines" /etc/nginx/nginx.conf
    	echo -e "${YELLOW} \n Added limits in nginx.conf. Changes made.${RESET}"
	#sudo sed -i '/http {/a \    client_max_body_size 25M;\n    underscores_in_headers on;' /etc/nginx/nginx.conf
        
   	# Verify the syntax of the modified nginx.conf file
    	echo -e "${CYAN} \n Checking syntax of the modified nginx.conf file... \n${RESET}"
    	sudo nginx -t
    	echo -e "${GREEN} \n HTTP block configured.${RESET}"
    
   else
   	echo -e "${YELLOW} \n Limits already exist in nginx.conf. No changes made.${RESET}"
   fi


    # Start Nginx
    echo -e "${CYAN} \n Starting Nginx...${RESET}"
    sudo systemctl start nginx
    echo -e "${GREEN} \n Nginx started.${RESET}"
    sleep $SLEEP_TIMES

    # Status Nginx
    echo -e "${CYAN} \n Getting status of Nginx... \n\n${RESET}"
    sudo systemctl status nginx
    echo -e "${CYAN} \n End->4 Status got Nginx.\n${RESET}"
    sleep $SLEEP_TIMES
}

# Install MondoDB
setup_mongo(){
    # Get user input to install MongoDB
    echo -e "${CYAN} 5-> Do you want to install MongoDB? (Y/n) ${RESET}"
    echo -e "${Yellow} Press 'y' if you want to use the DB in local ${RESET}"
    echo -e "${Yellow} Press 'n' if you want to use the Atlas DB and refer the documentation section 6.5 ${RESET}"
    read install_mongo
    if [ "$install_mongo" = "y" ] || [ "$install_mongo" = "Y" ]; then
        # Install MongoDB
        echo -e "${CYAN} \n Installing MongoDB... ${RESET}"
        # Get MongoDB version input
        echo -e "${CYAN} Please select MongoDB Version\n ${RESET}"
        select opt in "${MONGO_VERSIONS_OPTIONS[@]}"; do
            case $opt in
                "4.4")
                    MONGODB_VERSION="4.4"
                    MONGODB_VERSION_EXTENDED="4.4.19" #get this from mongo documentation installation step if you want to add more options
                    break
                    ;;
                "5.0")
                    MONGODB_VERSION="5.0"
                    MONGODB_VERSION_EXTENDED="5.0.15"
                    break
                    ;;
                "6.0")
                    MONGODB_VERSION="6.0"
                    MONGODB_VERSION_EXTENDED="6.0.4"
                    break
                    ;;
                *) echo -e "${RED} Invalid option";;
            esac
        done
        echo -e "${GREEN} \n You have selected MongoDB Version : $MONGODB_VERSION\n${RESET}"
        sleep $SLEEP_TIMES

        # Add MongoDB repository
        echo -e "${CYAN}\n Adding MongoDB repository...${RESET}"
        echo -e "${CYAN}version $MONGODB_VERSION...${RESET}"
        wget -qO - https://www.mongodb.org/static/pgp/server-$MONGODB_VERSION.asc | sudo apt-key add -
        echo -e "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -sc)/mongodb-org/$MONGODB_VERSION multiverse" | sudo tee /etc/apt/sources.  list.d/mongodb-org-$MONGODB_VERSION.list

        # Install MongoDB
        echo -e "${CYAN}\n Installing MongoDB...${RESET}"
        echo -e "${CYAN}version $MONGODB_VERSION...${RESET}"
        sudo apt-get update
        sudo apt-get install -y mongodb-org=$MONGODB_VERSION_EXTENDED mongodb-org-server=$MONGODB_VERSION_EXTENDED mongodb-org-shell=$MONGODB_VERSION_EXTENDED mongodb-org-mongos=$MONGODB_VERSION_EXTENDED mongodb-org-tools=$MONGODB_VERSION_EXTENDED
        echo "mongodb-org hold" | sudo dpkg --set-selections
        echo "mongodb-org-server hold" | sudo dpkg --set-selections
        echo "mongodb-org-shell hold" | sudo dpkg --set-selections
        echo "mongodb-org-mongos hold" | sudo dpkg --set-selections
        echo "mongodb-org-tools hold" | sudo dpkg --set-selections
        echo -e "${GREEN}\nMongoDB version $MONGODB_VERSION installed successfully.${RESET}"

        # Find Installed Mongo Version
        echo -e "${CYAN} \n Finding Installed MongoDB version${RESET}\n"
        sudo mongod --version
        sleep $SLEEP_TIMES

        # Starting MongoDB server
        echo -e "${CYAN} \n Starting MongoDB server${RESET}\n"
        sudo systemctl start mongod
        sleep $SLEEP_TIMES

        # MongoDB server enable to ensure that MongoDB will start following a system reboot 
        echo -e "${CYAN} \n enable MongoDB server to start on system reboot${RESET}\n"
        sudo systemctl enable mongod
        sleep $SLEEP_TIMES

        # MongoDB server status
        echo -e "${CYAN} \n MongoDB server status${RESET}\n"
        sudo timeout 2 systemctl status mongod
        sleep $SLEEP_TIMES
        echo -e "${CYAN} End->5 MongoDB installed.${RESET}"
    else
        echo -e "${CYAN} End->5 MongoDB installation skipped.${RESET}"
    fi
}

# Installing Redis Session Management Server
setup_redis(){
    echo -e "${CYAN} \n 6-> Installing Redis Session Management Server\n${RESET}"
    sudo apt-get install -y redis-server
    sudo service redis-server status
    echo -e "${CYAN} End->6 Redis Installed successfully.${RESET}"

}

# Install nodemon
setup_nodemon(){
    echo -e "${CYAN} \n 7-> Installing nodemon\n\n${RESET}"
    sudo npm install nodemon -g
    echo -e "${CYAN} \n End->7 nodemon installed.${RESET}"
    sleep $SLEEP_TIMES
}

# Install pm2
setup_pm2(){
    echo -e "${CYAN} \n 8-> Installing pm2\n\n${RESET}"
    sudo npm i pm2 -g
    echo -e "${CYAN} \n End->8 pm2 installed.${RESET}"
    sleep $SLEEP_TIMES
}

# Install Git
setup_git(){
    echo -e "${CYAN} \n 9->f Installing Git...\n\n${RESET}"
    sudo apt-get install -y git
    echo -e "${CYAN} \n End->9 Git installed.${RESET}"
    sleep $SLEEP_TIMES
}

#Clone git repo from here
clone_git_repo(){

    # Loop to clone Git repositories
    while true; do
        # Prompt for Git repository URL
        echo -e "${CYAN} Enter the ${YELLOW}Git repository URL${CYAN} you want to clone, or ${YELLOW}'q'${CYAN} to ${RED}quit: ${RESET}"
        read repo_url
        
        # Check if user wants to quit
        if [ "$repo_url" = "q" ]; then
            echo -e "${CYAN} End->10 Git clonning Exited.${RESET}"
            break
        fi
        
        # Clone the Git repository
        echo -e "${CYAN} Cloning Git repository ${YELLOW}$repo_url...${RESET}"
        sudo git clone $repo_url

        while true; do
            # echo -e "${YELLOW} Do you want to perform more acrions in this repository? Press ${CYAN}'q'${YELLOW} to quite or ${CYAN}y${YELLOW} to continue: ${RESET}"
            # read more_action

            # # Check if user wants to quit
            
            is_exit='n'
            echo -e "${YELLOW} Please select action to perform\n ${RESET}"
            select opt in "${REPO_ACTIONS_OPTIONS[@]}"; do
                case $opt in
                    "Install dependancy")
                        repo_name=$(basename $repo_url .git) # will extract the last name from the Git repository URL

                        if [ "$repo_name" = "backend" ]; then
                            #server dependency install
                            echo -e "${YELLOW} \n Entering into : ${CYAN}$repo_name/server ${RESET}"
                            cd $repo_name/server;
                            echo -e "${YELLOW} \n Installing dependancies...${RESET}"
                            sudo npm install --legacy-peer-deps
                            echo -e "${GREEN} \n Dependancy installed.${RESET}"
                            cd ..

                            #payments dependency install
                            echo -e "${YELLOW} \n Entering into : ${CYAN}$repo_name/payments ${RESET}"
                            cd payments/;
                            echo -e "${YELLOW} \n Installing dependancies...${RESET}"
                            sudo npm install --legacy-peer-deps
                            echo -e "${GREEN} \n Dependancy installed.${RESET}"
                            cd ..

                            #history dependency install
                            echo -e "${YELLOW} \n Entering into : ${CYAN}$repo_name/history-earning ${RESET}"
                            cd history-earning/;
                            echo -e "${YELLOW} \n Installing dependancies...${RESET}"
                            sudo npm install --legacy-peer-deps
                            echo -e "${GREEN} \n Dependancy installed.${RESET}"
                            cd ..

                            #mass notification dependency install
                            echo -e "${YELLOW} \n Entering into : ${CYAN}$repo_name/mass_notification ${RESET}"
                            cd mass_notification/;
                            echo -e "${YELLOW} \n Installing dependancies...${RESET}"
                            sudo npm install --legacy-peer-deps
                            echo -e "${GREEN} \n Dependancy installed.${RESET}"
                            cd ../..
                            break
                        else
                            # repo_name=$(basename $repo_url .git) # will extract the last name from the Git repository URL,
                            echo -e "${YELLOW} \n Entering into : ${CYAN}$repo_name ${RESET}"
                            cd $repo_name;
                            echo -e "${YELLOW} \n Installing dependancies...${RESET}"
                            sudo npm install --legacy-peer-deps
                            echo -e "${GREEN} \n Dependancy installed.${RESET}"
                            cd ..
                            break
                        fi
                        ;;
                    "Install intial data(If the repo is BACKEND)")
                        repo_name=$(basename $repo_url .git) # will extract the last name from the Git repository URL,
                        
                        
                        if [ "$repo_name" = "backend" ]; then
		                echo -e "${YELLOW} \n Entering into : ${CYAN}$repo_name/server/settingsdata...${RESET}"
		                echo -e "${YELLOW} \n It may take 5-10 seconds to complete${RESET}"
		                cd $repo_name/server/settingsdata
		                echo -e "${YELLOW} \n Installing intial data...${RESET}"
		                sudo node initial_data.js
		                echo -e "${GREEN} \n intial data installed.${RESET}"
		                sleep 5 #Delay the script execution for 5 seconds
		                # process.exit(0);
		                cd ../../..
		                break
		        else
		         	echo -e "${YELLOW} \n Intial data can only be initiated in the server repo, you are in ${CYAN}${repo_name}...${RESET}"
		         	break
		         fi
                        
                        break
		       	;;
		       

                    "Start PM2 server")
                        repo_name=$(basename $repo_url .git) # will extract the last name from the Git repository URL,
                        
                        if [ "$repo_name" = "backend" ]; then
                            # Get total RAM in bytes and convert to megabytes (MB)
                            TOTAL_RAM=$(($(grep MemTotal /proc/meminfo | awk '{print $2}') / 1024))
                            # Get total number of CPU cores
                            CPU_CORE=$(grep -c ^processor /proc/cpuinfo)
                            MAX_MEMORY_RESTART=$((($TOTAL_RAM - 2000) / $CPU_CORE))M

                            echo -e "${YELLOW} \n Entering into : ${CYAN}$repo_name${RESET}"
                            cd $repo_name

                            echo -e "${YELLOW} \n Entering into Server repo"
                            cd server/
                            echo -e "${YELLOW} \n Starting PM2 server..${RESET}"
                            pm2 start server.js -i max --max-memory-restart $MAX_MEMORY_RESTART --name $repo_name --env "{\"NODE_ENV\":\"production\"}"
                            echo -e "${GREEN} \n Successfully start PM2 for Server.${RESET}"
                            cd ..

                            echo -e "${YELLOW} \n Entering into Payments repo"
                            cd payments/       
                            echo -e "${YELLOW} \n Starting PM2 payments..${RESET}"
                            pm2 start server.js --name payment
                            echo -e "${GREEN} \n Successfully start PM2 for Payments.${RESET}"
                            cd ..

                            echo -e "${YELLOW} \n Entering into History-earning repo"
                            cd history-earning/
                            echo -e "${YELLOW} \n Starting PM2 history-earning..${RESET}"
                            pm2 start server.js --name history
                            echo -e "${GREEN} \n Successfully start PM2 for history-earning.${RESET}"
                            cd ..

                            echo -e "${YELLOW} \n Entering into Mass-notification repo"
                            cd mass_notification/
                            echo -e "${YELLOW} \n Starting PM2 mass_notification..${RESET}"
                            pm2 start server.js --name mass-notification
                            echo -e "${GREEN} \n Successfully start PM2 for mass_notification.${RESET}"
                            cd ../..

                            break
                        else
                            echo -e "${YELLOW} \n Entering into : ${CYAN}$repo_name${RESET}"
                            cd $repo_name
                            pm2 start server.js --name $repo_name
                            echo -e "${GREEN} \n Successfully start PM2 for ${repo_name}.${RESET}"
                            break
                        fi
                        ;;

                    "Build project")
                        # Get base url
                        repo_name=$(basename $repo_url .git)
                        
                        if [ "$repo_name" != "backend" ]; then
                        
                        
		                echo -e "${CYAN} Enter the ${YELLOW}Full Base URL:- For example https://api.fulldomain ${RESET}"
		                read base_url

		                #remove tailing / and add htts:// if not present
		                base_url=${base_url%/}
		                if [[ $base_url != https://* ]] && [[ $base_url != http://* ]]; then
		                    base_url="https://$base_url"
		                fi

		                repo_name=$(basename $repo_url .git) # will extract the last name from the Git repository URL,
		                echo -e "${YELLOW} \n Entering into : ${CYAN}$repo_name${RESET}"
		                cd $repo_name
		                
		                echo -e "${YELLOW} \n Setting Base URL...${RESET}"
		                # Comment out existing URL variables

		                sudo sed -i '/API_URL/ s/^/\/\//' src/environments/environment.prod.ts
		                sudo sed -i '/IMAGE_URL/ s/^/\/\//' src/environments/environment.prod.ts
		                sudo sed -i '/BASE_URL/ s/^/\/\//' src/environments/environment.prod.ts
		                sudo sed -i '/SOCKET_URL/ s/^/\/\//' src/environments/environment.prod.ts
		                sudo sed -i '/MASS_NOTIFICATION_API_URL/ s/^/\/\//' src/environments/environment.prod.ts
		                sudo sed -i '/HISTORY_API_URL/ s/^/\/\//' src/environments/environment.prod.ts
		                sudo sed -i '/PAYMENTS_API_URL/ s/^/\/\//' src/environments/environment.prod.ts

		                # Add new URL
		                repo_name_part="${repo_name%-*}"
		                api_url_with_repo="${base_url}/${repo_name_part}"

		                historyreplacedUrl=$(echo "$base_url" | sed 's/api\./history\./')
		                massreplacedUrl=$(echo "$base_url" | sed 's/api\./notification\./')
		                paymentreplacedurl=$(echo "$base_url" | sed 's/api\./payment\./')

		                if [[ "$repo_name" == "admin-panel" || "$repo_name" == "dispatcher-panel" ]]; then
		                    sudo sed -i "/environment = {/a \    API_URL: '${api_url_with_repo}',\n IMAGE_URL: '${base_url}/',\n BASE_URL: '${base_url}/', \n MASS_NOTIFICATION_API_URL: '${massreplacedUrl}', \n HISTORY_API_URL: '${historyreplacedUrl}',\n SOCKET_URL: '${base_url}/',\n" src/environments/environment.prod.ts
		                else
		                    sudo sed -i "/environment = {/a \    API_URL: '${base_url}',\n IMAGE_URL: '${base_url}/',\n BASE_URL: '${base_url}/', \n MASS_NOTIFICATION_API_URL: '${massreplacedUrl}', \n HISTORY_API_URL: '${historyreplacedUrl}', \n PAYMENTS_API_URL: '${paymentreplacedurl}'\n SOCKET_URL: '${base_url}/',\n" src/environments/environment.prod.ts
		                fi
		                
		                echo -e "${YELLOW} \n Building Project..${RESET}"
		                sudo npm run build
		                echo -e "${GREEN} \n Project Build completed.${RESET}"
		                cd ..
		                break
		        
		        else
		        	echo -e "${YELLOW} \n Build project is not allowed in the BACKEND repo,...${RESET}"
		        	break
		        fi
                        ;;

                    "EXIT")
                        is_exit='y'
                        break
                        ;;
                    *) echo -e "${RED} Invalid option";;
                esac
            done

            echo -e "is Exit ${is_exit}"

            if [ "$is_exit" = "y" ]; then
                break
            fi
            
            sleep $SLEEP_TIMES
        done

        # Check if cloning was successful
        if [ $? -eq 0 ]; then
            echo -e "${GREEN} Git repository $repo_url cloned successfully.${RESET}"
            sleep $SLEEP_TIMES
        else
            echo -e "${RED} Error cloning Git repository $repo_url.${RESET}"
        fi
    done

}

#Setup project from Git
setup_project(){

    echo -e "${CYAN} 10-> Press 'y' if and only if you are installing the project on server and if you are installing the project in local press 'n' and skip this step.(Y/n) ${RESET}"
    read Create_Project
    if [ "$Create_Project" = "y" ] || [ "$Create_Project" = "Y" ]; then	
	    # Now create blank directory and clone project from git
	    sudo chmod -R 777 /var/www/html
	    echo -e "${CYAN} \n Enter your project name :${RESET}"
	    read project_name
	    cd /var/www/html
	    mkdir $project_name
	    echo -e "${GREEN} \n Directory created.${RESET}"
	    echo -e "${CYAN} \n Entering into directory...${RESET}"
	    cd /var/www/html/$project_name
	    clone_git_repo
    else
    	echo -e "${GREEN} 10-> Skipped the Project Setup step.${RESET}"
    fi
	    	   
}

#Pm2 startup and save in the server
pm2_startup(){
    echo -e "${CYAN} 11-> Adding PM2 startup script ${RESET}"
    sudo pm2 startup
    sudo systemctl enable pm2-root
    sudo pm2 save
    echo -e "${CYAN} End->11 PM2 startup setting done ${RESET}"
}

#Nginx default file for our domains
setup_nging_default_file(){
    # Get user input to configure Nginx default file
    echo -e "${CYAN} 12-> Do you want to Configure NGINX Default File? (Y/n) ${RESET}"
    read CONFIG_DEFAULT
    if [ "$CONFIG_DEFAULT" = "y" ] || [ "$CONFIG_DEFAULT" = "Y" ]; then
        #suggestion to client 
        echo -e "${RED} Please refer installation document(point 6.4) ${RESET}"
        echo -e "${YELLOW} Use 10 number of domains/servers for this product ${RESET}"

        # Ask the user for the number of sites to create
        echo -e "${CYAN} Enter the number of domains/servers to create: ${RESET}"
        read num_sites

        # Define the backup file name and location
        backup_file="/etc/nginx/sites-available/default.bak"

        # Define the new blank config file name and location
        new_config_file="/etc/nginx/sites-available/default.new"

        # Create a backup of the initial default configuration file
        sudo cp /etc/nginx/sites-available/default $backup_file

        # Create a new blank configuration file
        sudo touch $new_config_file

        # Loop through each site and ask for the domain and port number
        for ((i=1; i<=$num_sites; i++)); do
            echo -e "${CYAN} \n\n Enter the ${YELLOW}domain name${CYAN} for ${YELLOW}site $i: ${RESET}"
            read domain_name

            echo -e "${CYAN} Enter the ${YELLOW}port number${CYAN} for ${YELLOW}site $i: ${RESET}"
            read port_number


            # Create a new server block for the site and append it to the new config file
            dir_name="${domain_name%%.*}"
            capitalized_char="${dir_name^^}"
            echo "
            #$capitalized_char
            server {
            	listen 80;
                server_name $domain_name;

                location / {
                    proxy_pass http://localhost:$port_number;
                    proxy_http_version 1.1;
                    proxy_set_header Upgrade \$http_upgrade;
                    proxy_set_header Connection 'upgrade';
                    proxy_set_header Host \$host;
                    proxy_cache_bypass \$http_upgrade;
                
	    	}
	    	
	    	ssl_certificate /var/www/html/SSL/origin.pem;
    		ssl_certificate_key /var/www/html/SSL/private.pem;
	    	" | sudo tee -a $new_config_file > /dev/null

            # If port number is 5000 (Backend server), add the 'location /gmapsapi' block of code
            if [ "$port_number" -eq 5000 ]; then
                echo "    location /gmapsapi {
                    proxy_pass https://maps.googleapis.com/;
                    proxy_pass_request_body on;
                    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                }
            }" | sudo tee -a $new_config_file > /dev/null
            else
                echo "}" | sudo tee -a $new_config_file > /dev/null
            fi

        done

        # Replace the original default configuration file with the new config file
        sudo mv $new_config_file /etc/nginx/sites-available/default

        # # Create a symbolic link to enable the site
        # sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/

        # Restart Nginx to apply the changes
        sudo systemctl restart nginx
        echo -e "${CYAN} End->12 Nginx Default file configured.${RESET}"
        sleep $SLEEP_TIMES
    else
        echo -e "${CYAN} End->12 Nginx Default file configuration skipped.${RESET}"
    fi
}

#Certbot install
download_letsencrypt_ssl_cert(){
    sudo certbot --nginx
    sudo systemctl restart nginx
}

#Install let's encrypt
install_letsencrypt_ssl(){
    # Get user input to configure Nginx default file
    echo -e "${CYAN} 13-> Do you want to install ${YELLOW}Let's Encrypt${CYAN} SSL Certificates? (Y/n) ${RESET}"
    read INSTALL_LETS_ENCYPT
    if [ "$INSTALL_LETS_ENCYPT" = "y" ] || [ "$INSTALL_LETS_ENCYPT" = "Y" ]; then
        # Install MongoDB

        # update_packages
        # sudo apt-get install software-properties-common
        # sudo apt-get install software-properties-common
        # sudo add-apt-repository universe
        # sudo add-apt-repository ppa:certbot/certbot
        # sudo apt-get update
        sudo apt-get install -y certbot python3-certbot-nginx

	sudo sed -i '/ssl_certificate \/var\/www\/html\/SSL\/origin.pem;/d' /etc/nginx/sites-available/default
	sudo sed -i '/ssl_certificate_key \/var\/www\/html\/SSL\/private.pem;/d' /etc/nginx/sites-available/default
        echo -e "${CYAN} Enter the number of domains/servers to create: ${RESET}"
        read num_sites

        for ((i=1; i<=$num_sites; i++)); do
            download_letsencrypt_ssl_cert
        done

        echo -e "${CYAN} End->13 Let's Encrypt certificates installed${RESET}"
        sleep $SLEEP_TIMES
    else
        echo -e "${CYAN} End->13 Let's Encrypt certificates installation skipped.${RESET}"
    fi
}

#If user choose cutom installation
custom_installation() {
    while true; do
        echo -e "${YELLOW}\n Choose an option${RESET}"
        echo -e "${CYAN} 1. Update Packages${RESET}"
        echo -e "${CYAN} 2. NodeJS 2${RESET}"
        echo -e "${CYAN} 3. Angular${RESET}"

        echo -e "${CYAN} 4. Nginx${RESET}"
        echo -e "${CYAN} 5. MongoDB${RESET}"
        echo -e "${CYAN} 6. Redis${RESET}"
        echo -e "${CYAN} 7. Nodemon${RESET}"
        echo -e "${CYAN} 8. PM2${RESET}"
        echo -e "${CYAN} 9. Install Git${RESET}"
        echo -e "${CYAN} 10. Setup Your Project${RESET}"
        echo -e "${CYAN} 11. PM2 startup${RESET}"
        echo -e "${CYAN} 12. Setup Nginx Default File${RESET}"
        echo -e "${CYAN} 13. Install Letencrypt${RESET}"

        echo -e "${CYAN} 0. Exit${RESET}"
        read -p " Enter your choice: " choice

        case $choice in
            1) update_packages ;;
            2) setup_nodejs ;;
            3) setup_angular ;;
            4) setup_nginx ;;
            5) setup_mongo ;;
            6) setup_redis ;;
            7) setup_nodemon ;;
            8) setup_pm2 ;;
            9) setup_git ;;
            10) setup_project ;;
            11) pm2_startup ;;
            12) setup_nging_default_file ;;
            13) install_letsencrypt_ssl ;;
            0) break ;;
            *) echo -e "${RED} Invalid choice. Please enter a number between 0 and 13.${RESET}" ;;
        esac
    done
}

#Installation choices
installtion_choice(){
    echo -e "${YELLOW}\n Choose Installation type${RESET}"
    echo -e "${CYAN} 1. Full Installation${RESET}"
    echo -e "${CYAN} 2. Custom Installation${RESET}"
    read -p " Enter your choice [1-2]: " selected_installation

    if [[ "$selected_installation" == "1" ]]; then
        echo -e "${YELLOW} Performing full installation...\n${RESET}"
        # CallING functions for full installation
        update_packages
        #uninstall_nodejs  it's been already called in setup_node.js function
        setup_nodejs
        setup_angular
        setup_nginx
        setup_mongo
        setup_redis
        setup_nodemon
        setup_pm2
        setup_git
        setup_project
        pm2_startup
        setup_nging_default_file
        install_letsencrypt_ssl
    elif [[ "$selected_installation" == "2" ]]; then
        echo -e "${YELLOW} Performing custom installation...\n${RESET}"
        custom_installation
        # Call your function(s) for custom installation here
    else
        echo -e "${RED} Invalid input. Please enter either 1 or 2.{RESET}"
    fi
}

#Check support ubuntu version of server
check_support
