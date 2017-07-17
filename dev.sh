#!/bin/sh

tmux new-session -s development -n Daemons -d
tmux send-keys -t development 'npm run watch:client' C-m
tmux split-window -v -t development
tmux send-keys -t development 'npm run watch:server' C-m
tmux split-window -v -t development
tmux send-keys -t development 'npm run mon' C-m
tmux split-window -v -t development
tmux select-layout -t development tiled
tmux attach -t development
