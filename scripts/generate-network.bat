@echo off
setlocal enabledelayedexpansion

echo Generation du reseau Besu QBFT...

:: Configuration QBFT ecrite via un fichier annexe (evite les soucis d'echappement)
call :writeConfig

:: Generation avec Docker
docker run --rm -v "%cd%/config:/config" -v "%cd%/services/nodes:/nodes" hyperledger/besu:latest operator generate-blockchain-config --config-file=/config/qbftConfigFile.json --to=/nodes/networkFiles --private-key-file-name=key

:: Copier le genesis
if exist services\nodes\networkFiles\genesis.json copy services\nodes\networkFiles\genesis.json .

:: Distribuer les cles
set /a idx=0
for /f "delims=" %%a in ('dir /b services\nodes\networkFiles\keys') do (
  set /a idx+=1
  if !idx!==1 (
    copy services\nodes\networkFiles\keys\%%a\key services\nodes\node-1\data\
    copy services\nodes\networkFiles\keys\%%a\key.pub services\nodes\node-1\data\
  )
  if !idx!==2 (
    copy services\nodes\networkFiles\keys\%%a\key services\nodes\node-2\data\
    copy services\nodes\networkFiles\keys\%%a\key.pub services\nodes\node-2\data\
  )
  if !idx!==3 (
    copy services\nodes\networkFiles\keys\%%a\key services\nodes\node-3\data\
    copy services\nodes\networkFiles\keys\%%a\key.pub services\nodes\node-3\data\
  )
  if !idx!==4 (
    copy services\nodes\networkFiles\keys\%%a\key services\nodes\node-4\data\
    copy services\nodes\networkFiles\keys\%%a\key.pub services\nodes\node-4\data\
  )
)

echo Reseau genere avec succes !
goto :eof

:writeConfig
> config\qbftConfigFile.json (
echo {
echo   "genesis": {
echo     "config": {
echo       "chainId": 1337,
echo       "berlinBlock": 0,
echo       "londonBlock": 0,
echo       "qbft": {
echo         "epochlength": 30000,
echo         "blockperiodseconds": 2,
echo         "requesttimeoutseconds": 4
echo       }
echo     },
echo     "nonce": "0x0",
echo     "timestamp": "0x58ee40ba",
echo     "gasLimit": "0x1C9C380",
echo     "difficulty": "0x1",
echo     "mixHash": "0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365",
echo     "coinbase": "0x0000000000000000000000000000000000000000",
echo     "alloc": {
echo       "fe3b557e8fb62b89f4916b721be55ceb828dbd73": {
echo         "balance": "0x200000000000000000000000000000000000000000000000000000000000000"
echo       }
echo     }
echo   },
echo   "blockchain": {
echo     "nodes": {
echo       "generate": true,
echo       "count": 4
echo     }
echo   }
echo }
)
exit /b
