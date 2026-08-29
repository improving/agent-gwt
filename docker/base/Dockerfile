# Shared base for agent-gwt agent images (cursor, and future agents).
# Extend with: FROM agent-gwt/base:local
# AUR installs (build-time only): USER aur && yay -S --noconfirm ... && USER root
FROM archlinux:latest

RUN pacman -Sy --noconfirm --needed \
      base-devel git sudo curl ca-certificates \
  && useradd -m aur \
  && echo 'aur ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/aur \
  && chmod 0440 /etc/sudoers.d/aur \
  && pacman -Scc --noconfirm

USER aur
WORKDIR /home/aur
RUN git clone https://aur.archlinux.org/yay-bin.git /tmp/yay-bin \
  && cd /tmp/yay-bin \
  && makepkg -si --noconfirm \
  && rm -rf /tmp/yay-bin

USER root
WORKDIR /
